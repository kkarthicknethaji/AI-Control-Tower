import pkg from '../../package.json';

// Single source of truth: "version" in ai-control-tower-react/package.json.
export const APP_NAME = 'AI Control Tower';
export const APP_VERSION: string = pkg.version;
export const APP_DISPLAY_VERSION = `v${APP_VERSION}`;
