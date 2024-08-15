import type { PagesJson } from './types';
import fs from 'node:fs';
import { loadConfig } from 'unconfig';
import { getConfig } from './config';
import { PAGES_CONFIG_EXT, PAGES_CONFIG_FILE } from './constant';
import { debug } from './utils/debug';

export function UniPagesJson(userConfig: Partial<PagesJson>) {
  return userConfig;
}

export function checkPagesJsonFile() {
  const config = getConfig();

  if (!fs.existsSync(config.pagesJsonFile)) {
    fs.writeFileSync(
      config.pagesJsonFile,
      JSON.stringify({ pages: [{ path: '' }] }, null, 2),
      { encoding: 'utf-8' },
    );
    return false;
  }

  return true;
}

function emptyPagesJson() {
  const options: PagesJson = {
    pages: [],
    globalStyle: {
      navigationBar: {},
    },
  };
  return options;
}

let pagesConfig: PagesJson | undefined;
let pagesConfigFiles: string[] = [];
export async function getPagesConfig() {
  if (!pagesConfig) {
    await loadPagesConfig();
  }

  return pagesConfig || emptyPagesJson();
}

export async function getPagesConfigFiles() {
  if (!pagesConfigFiles.length) {
    await loadPagesConfig();
  }

  return pagesConfigFiles;
}

export async function loadPagesConfig(forceUpdate = false) {
  if (!forceUpdate && !!pagesConfig) {
    return {
      sources: pagesConfigFiles,
      config: pagesConfig,
    };
  }

  const config = getConfig();

  const res = await loadConfig<PagesJson>({
    cwd: config.basePath,
    sources: {
      files: PAGES_CONFIG_FILE,
      extensions: PAGES_CONFIG_EXT,
    },
    defaults: {
      pages: [],
      globalStyle: {
        navigationBar: {},
      },
    },
  });

  pagesConfig = res.config;
  pagesConfigFiles = res.sources;

  debug.loadPagesConfig(res.sources);
  debug.loadPagesConfig(JSON.stringify(res.config, null, 2));

  return res;
}
