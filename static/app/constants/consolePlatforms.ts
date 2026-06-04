export enum ConsolePlatform {
  NINTENDO_SWITCH = 'nintendo-switch',
  PLAYSTATION = 'playstation',
  XBOX = 'xbox',
}

// Repository owner for console SDK repositories. Change this for testing with your own GitHub org.
const CONSOLE_SDK_REPO_OWNER = 'getsentry';

export const CONSOLE_PLATFORM_METADATA = {
  [ConsolePlatform.NINTENDO_SWITCH]: {
    displayName: 'Nintendo Switch',
    repoURL: `https://github.com/${CONSOLE_SDK_REPO_OWNER}/sentry-switch`,
  },
  [ConsolePlatform.PLAYSTATION]: {
    displayName: 'PlayStation',
    repoURL: `https://github.com/${CONSOLE_SDK_REPO_OWNER}/sentry-playstation`,
  },
  [ConsolePlatform.XBOX]: {
    displayName: 'Xbox',
    repoURL: `https://github.com/${CONSOLE_SDK_REPO_OWNER}/sentry-xbox`,
  },
};
