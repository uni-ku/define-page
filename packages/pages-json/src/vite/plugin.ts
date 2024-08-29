import type { UserConfig } from '../config';
import type { Plugin } from 'vite';
import { spawn } from 'node:child_process';
import process from 'node:process';
import chokidar from 'chokidar';
import MagicString from 'magic-string';
import { DEFINE_PAGE } from '../constant';
import { ctx } from '../context';
import { checkPagesJsonFile } from '../pagesJson';
import { debug } from '../utils';
import { setupViteServer, setupWatcher } from './watch';

async function restart() {
  return new Promise((resolve) => {
    const build = spawn(process.argv.shift()!, process.argv, {
      cwd: process.cwd(),
      detached: true,
      env: process.env,
    });
    build.stdout?.pipe(process.stdout);
    build.stderr?.pipe(process.stderr);
    build.on('close', (code) => {
      resolve(process.exit(code!));
    });
  });
}

export function viteUniPagesJson(userConfig: UserConfig = {}): Plugin {
  ctx.init(userConfig);

  checkPagesJsonFile();

  return {
    name: '@uni-ku/define-page',
    enforce: 'pre',
    async configResolved(viteConf) {
      if (!userConfig.root) {
        ctx.config.root = viteConf.root;
      }
      await ctx.updatePagesJSON();

      if (viteConf.command === 'build') {
        if (!checkPagesJsonFile()) {
          debug.error('In build mode, if `pages.json` does not exist, the plugin cannot create the complete `pages.json` before the uni-app, so it restarts the build.');
          await restart();
        }

        if (viteConf.build.watch) {
          setupWatcher(chokidar.watch([...ctx.files.keys()]));
        }
      }
    },
    async transform(code: string, id: string) {
      const file = ctx.files.get(id);
      if (!file) {
        return;
      }

      const setup = file.getScriptSetup();

      const macro = setup?.findMacro(DEFINE_PAGE);
      if (!macro) {
        return;
      }

      const s = new MagicString(code);
      s.remove(macro.start! + setup.loc.start.offset, macro.end! + setup.loc.start.offset);

      if (s.hasChanged()) {
        const code = s.toString();

        // debug.watcher({ code });
        return {
          code,
          map: s.generateMap({
            source: id,
            includeContent: true,
            file: `${id}.map`,
          }),
        };
      }
    },
    configureServer(server) {
      setupViteServer(server);
    },
  };
}
