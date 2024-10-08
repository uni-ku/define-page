import type { PagesJson } from './types';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile as writeFile_ } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { slash } from '@antfu/utils';

export function getDeclaration(pagesJSON: PagesJson) {
  const subPagesPaths = (pagesJSON.subPackages || []).map((sub) => {
    return (sub.pages || []).map(v => (`"/${slash(join(sub.root!, v.path))}"`));
  }).flat();
  const tabPaths = (pagesJSON.tabBar?.list || []).map((v) => {
    return `"/${v!.pagePath}"`;
  });
  const allPagesPath = [...(pagesJSON.pages || []).filter(page => !tabPaths.includes(page.path)).map(v => `"/${v.path}"`), ...subPagesPaths];
  const code = `/* eslint-disable */
/* prettier-ignore */
// @ts-nocheck
// Generated by @uni-ku/define-page

interface NavigateToOptions {
  url: ${allPagesPath.join(' |\n       ')};
}
interface RedirectToOptions extends NavigateToOptions {}

interface SwitchTabOptions {
  ${tabPaths.length ? `url: ${tabPaths.join(' |\n       ')};` : ''}
}

type ReLaunchOptions = NavigateToOptions | SwitchTabOptions;

declare interface Uni {
  navigateTo(options: UniNamespace.NavigateToOptions & NavigateToOptions): void;
  redirectTo(options: UniNamespace.RedirectToOptions & RedirectToOptions): void;
  switchTab(options: UniNamespace.SwitchTabOptions & SwitchTabOptions): void;
  reLaunch(options: UniNamespace.ReLaunchOptions & ReLaunchOptions): void;
}
`;
  return code;
}

async function writeFile(filePath: string, content: string) {
  await mkdir(dirname(filePath), { recursive: true });
  return await writeFile_(filePath, content, 'utf-8');
}

export async function writeDeclaration(pagesJSON: PagesJson, filepath: string) {
  const originalContent = existsSync(filepath) ? await readFile(filepath, 'utf-8') : '';

  const code = getDeclaration(pagesJSON);
  if (!code) {
    return;
  }

  if (code !== originalContent) {
    await writeFile(filepath, code);
  }
}
