import type { Page } from './page';
import type { SFCScriptBlock } from '@vue/compiler-sfc';
import type { ParseResult } from 'ast-kit';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import generate from '@babel/generator';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { parse as parseSFC } from '@vue/compiler-sfc';
import { babelParse, isCallOf } from 'ast-kit';
import { getConfig } from './config';
import { runProcess } from './utils/child-process';
import { debug } from './utils/debug';

interface ScriptSetup extends SFCScriptBlock {
  ast: ParseResult<t.Program>;
  findMacro: (macro: string) => t.CallExpression | undefined;
  findImports: () => t.ImportDeclaration[];
  getMacroResult: <R = any>(macro: string) => Promise<R | undefined> | undefined;
}

export class File {
  /** absolute file path */
  readonly absolutePath: string;

  /** relative file path */
  readonly relativePath: string;

  private _filename: string | undefined;
  private _name: string | undefined;
  private _ext: string | undefined;

  private _content: string | undefined;
  private _scriptSetup: ScriptSetup | undefined;

  page: Page | undefined;

  constructor(filepath: string) {
    const config = getConfig();

    if (path.isAbsolute(filepath)) {
      this.absolutePath = filepath;
      this.relativePath = path.relative(config.basePath, this.absolutePath);
    }
    else {
      this.relativePath = filepath;
      this.absolutePath = path.join(config.basePath, this.relativePath);
    }
  }

  get filename() {
    if (!this._filename) {
      this._filename = path.basename(this.relativePath);
    }
    return this._filename;
  }

  get name() {
    if (!this._name) {
      this._name = path.parse(this.relativePath).name;
    }
    return this._name;
  }

  get ext() {
    if (!this._ext) {
      this._ext = path.extname(this.relativePath).slice(1);
    }
    return this._ext;
  }

  getContent(forceUpdate = false) {
    if (forceUpdate || !this._content) {
      this.setContent(fs.readFileSync(this.absolutePath, 'utf-8'));
    }
    return this._content!;
  }

  setContent(content: string | null) {
    this._scriptSetup = undefined; // 清空 script setup
    this._content = content === null ? undefined : content;
    return this;
  }

  getScriptSetup(forceUpdate = false) {
    if (forceUpdate || !this._scriptSetup) {
      this.getContent(forceUpdate); // 读取一次content
      this._scriptSetup = parseScriptSetup(this);
    }

    return this._scriptSetup!;
  }

  exec(expression: t.Expression, imports: t.ImportDeclaration[] = []) {
    return exec(this.absolutePath, expression, imports);
  }

  toString() {
    return this.absolutePath;
  }

  toJSON() {
    return this.absolutePath;
  }
}

function findMacro(script: t.Program, fn: string) {
  const nodes = script.body
    .map((raw: t.Node) => {
      let node = raw;
      if (raw.type === 'ExpressionStatement') {
        node = raw.expression;
      }
      return isCallOf(node, fn) ? node : undefined;
    })
    .filter((node): node is t.CallExpression => !!node);

  if (!nodes.length) {
    return;
  }

  if (nodes.length > 1) {
    throw new Error(`duplicate ${fn}() call`);
  }

  const macro = nodes[0];

  const [arg] = macro.arguments;

  if (arg && !t.isFunctionExpression(arg) && !t.isArrowFunctionExpression(arg) && !t.isObjectExpression(arg)) {
    throw new Error(`${fn}() only accept argument in function or object`);
  }

  return macro;
}

function findImports(script: t.Program) {
  return script.body
    .map((node: t.Node) => (node.type === 'ImportDeclaration') ? node : undefined)
    .filter((node): node is t.ImportDeclaration => !!node);
}

function parseScriptSetup(file: File) {
  const source = file.getContent();

  const { descriptor: sfc, errors } = parseSFC(source);

  if (errors.length) {
    debug.error('parseScriptSetup', errors);
    return;
  }

  if (!sfc.scriptSetup) {
    return;
  }

  const { scriptSetup } = sfc;

  const ast = babelParse(scriptSetup.content, scriptSetup.lang || 'js', {
    plugins: [['importAttributes', { deprecatedAssertSyntax: true }]],
  });

  return {
    ...scriptSetup,
    ast,
    findMacro: (macro: string) => findMacro(ast, macro),
    findImports: () => findImports(ast),
    getMacroResult: <R = any>(macro: string) => {
      const _macro = findMacro(ast, macro);
      if (!_macro) {
        return;
      }

      const [arg] = _macro.arguments as [t.Expression];

      if (!arg) {
        return;
      }

      const imports = findImports(ast);

      return exec<R>(file.absolutePath, arg, imports);
    },
  };
}

async function exec<R = any>(file: string, exp: t.Expression, imports: t.ImportDeclaration[]): Promise<R | undefined> {
  let tsx = path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');

  if (!fs.existsSync(tsx)) {
    tsx = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
  }

  if (!fs.existsSync(tsx)) {
    const config = getConfig();
    tsx = path.join(config.root, 'node_modules', '.bin', 'tsx');
  }

  if (!fs.existsSync(tsx)) {
    throw new Error(`[@uni-ku/define-page] "tsx" is required parse macro expression value`);
  }

  const ast = t.file(t.program([
    t.expressionStatement(exp),
  ]));

  // 删除代码里的 console
  traverse(ast, {
    CallExpression: (path, _parent) => {
      if (path.node.callee.type === 'MemberExpression' && (path.node.callee.object as any).name === 'console') {
        path.remove();
      }
    },
  });

  const code = generate(ast).code;

  const cwd = path.dirname(file);

  const randTxt = Math.random().toString(36).slice(-8);
  const delimiter = `====${randTxt}====`;

  let script = '';

  const importScript = imports.map(imp => `${generate(imp).code}\n`).join('');

  script += importScript;

  script += t.isFunctionExpression(exp) || t.isArrowFunctionExpression(exp)
    ? `let fn=${code}\nlet val=fn();\n`
    : `let val=${code}\n`;

  script += `Promise.resolve(val).then(res => { console.log('${delimiter}'); console.log(JSON.stringify(res)); })`;

  debug.exec(`\nFILE: ${file}`);
  // debug.exec(`SCRIPT: \n${script}`);

  const output = await runProcess(tsx, ['-e', script], { cwd });

  const result = output.split(delimiter).pop();

  const res: R | undefined = result ? JSON.parse(result) : undefined;

  debug.exec(`RESULT: ${JSON.stringify(res, null, 2)}`);

  return res;
}
