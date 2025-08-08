export enum ConsolePlatform {
  NINTENDO_SWITCH = 'nintendo-switch',
  PLAYSTATION = 'playstation',
  XBOX = 'xbox',
}

export const CONSOLE_PLATFORM_METADATA = {
  [ConsolePlatform.NINTENDO_SWITCH]: {
    displayName: 'Nintendo Switch',
    repoURL: 'https://github.com/getsentry/sentry-switch',
  },
  [ConsolePlatform.PLAYSTATION]: {
    displayName: 'PlayStation',
    repoURL: 'https://github.com/getsentry/sentry-playstation',
  },
  [ConsolePlatform.XBOX]: {
    displayName: 'Xbox',
    repoURL: 'https://github.com/getsentry/sentry-xbox',
  },
};
