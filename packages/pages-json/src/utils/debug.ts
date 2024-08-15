import Debug from 'debug';

const PREFIX = 'define-page:';

const DEBUG_TYPES = [
  'loadPagesConfig',
  'updatePagesJSON',
  'scanFiles',
  'exec',
  'watcher',
  'error',
  'getMacroResult',
  'parseScriptSetup',
  'mergePagesOptions',
] as const;

export type DebugType = typeof DEBUG_TYPES[number];

export const debug = generateDebug();

function generateDebug() {
  return Object.fromEntries(DEBUG_TYPES.map(t => ([t, Debug(PREFIX + t)]))) as Record<DebugType, Debug.Debugger>;
}

export function enableDebug(enable: boolean | DebugType) {
  if (!enable) {
    return;
  }

  const suffix = typeof enable === 'boolean' ? '*' : enable;

  Debug.enable(`${PREFIX}${suffix}`);
}
