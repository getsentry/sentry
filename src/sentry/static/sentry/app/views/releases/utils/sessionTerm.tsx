import {PlatformKey} from 'app/data/platformCategories';
import {t} from 'app/locale';

export enum SessionTerm {
  CRASHES = 'crashes',
  CRASHED = 'crashed',
  ABNORMAL = 'abnormal',
  CRASH_FREE_USERS = 'crash-free-users',
  CRASH_FREE_SESSIONS = 'crash-free-sessions',
  HEALTHY = 'healthy',
  ERRORED = 'errored',
  UNHANDLED = 'unhandled',
  STABILITY = 'stability',
}

export const sessionTerm = {
  [SessionTerm.CRASHES]: t('Crashes'),
  [SessionTerm.CRASHED]: t('Crashed'),
  [SessionTerm.ABNORMAL]: t('Abnormal'),
  [SessionTerm.CRASH_FREE_USERS]: t('Crash Free Users'),
  [SessionTerm.CRASH_FREE_SESSIONS]: t('Crash Free Sessions'),
  [SessionTerm.HEALTHY]: t('Healthy'),
  [SessionTerm.ERRORED]: t('Errored'),
  [SessionTerm.UNHANDLED]: t('Unhandled'),
};

// This should never be used directly (except in tests)
export const commonTermsDescription = {
  [SessionTerm.CRASHES]: t('Number of sessions with a crashed state'),
  [SessionTerm.CRASH_FREE_USERS]: t('Number of unique users with non-crashed sessions'),
  [SessionTerm.CRASH_FREE_SESSIONS]: t('Number of non-crashed sessions'),
  [SessionTerm.STABILITY]: t(
    'The percentage of crash free sessions and how it has changed since the last period.'
  ),
};

// This should never be used directly (except in tests)
export const mobileTermsDescription = {
  [SessionTerm.CRASHED]: t(
    'The process was terminated due to an unhandled exception or a request to the server that ended with an error'
  ),
  [SessionTerm.CRASH_FREE_SESSIONS]: t('Number of unique sessions that did not crash'),
  [SessionTerm.ABNORMAL]: t(
    'An unknown session exit. Like due to loss of power or killed by the operating system'
  ),
  [SessionTerm.HEALTHY]: t('A session without any errors'),
  [SessionTerm.ERRORED]: t('A crash which experienced errors'),
  [SessionTerm.UNHANDLED]: t('Not handled by user code'),
};

// This should never be used directly (except in tests)
export const desktopTermDescriptions = {
  crashed: t('The application crashed with a hard crash (eg. segfault)'),
  [SessionTerm.ABNORMAL]: t(
    'The application did not properly end the session, for example, due to force-quit'
  ),
  [SessionTerm.HEALTHY]: t(
    'The application exited normally and did not observe any errors'
  ),
  [SessionTerm.ERRORED]: t(
    'The application exited normally but observed error events while running'
  ),
  [SessionTerm.UNHANDLED]: t('The application crashed with a hard crash'),
};

function getTermDescriptions(platform: PlatformKey | null) {
  const technology =
    platform === 'react-native' ||
    platform === 'java-spring' ||
    platform === 'apple-ios' ||
    platform === 'dotnet-aspnetcore'
      ? platform
      : platform?.split('-')[0];

  switch (technology) {
    case 'dotnet':
    case 'java':
      return {
        ...commonTermsDescription,
        ...mobileTermsDescription,
      };
    case 'java-spring':
    case 'dotnet-aspnetcore':
      return {
        ...commonTermsDescription,
        ...mobileTermsDescription,
        [SessionTerm.CRASHES]: t(
          'A request that resulted in an unhandled exception and hence a Server Error response'
        ),
      };
    case 'android':
    case 'cordova':
    case 'react-native':
    case 'flutter':
      return {
        ...commonTermsDescription,
        ...mobileTermsDescription,
        [SessionTerm.CRASHED]: t(
          'An unhandled exception that resulted in the application crashing'
        ),
      };

    case 'apple': {
      return {
        ...commonTermsDescription,
        ...mobileTermsDescription,
        [SessionTerm.CRASHED]: t('An error that resulted in the application crashing'),
      };
    }
    case 'node':
    case 'javascript':
      return {
        ...commonTermsDescription,
        [SessionTerm.CRASHED]: t(
          "During the session an error with mechanism.handled===false occurred calling the 'onerror' on 'unhandledrejection' handler"
        ),
        [SessionTerm.ABNORMAL]: t('Non applicable for Javascript'),
        [SessionTerm.HEALTHY]: t('No errors were captured during session life-time'),
        [SessionTerm.ERRORED]: t(
          'During the session at least one error occurred that did not bubble up to the global handler. The application loading process did not crash'
        ),
        [SessionTerm.UNHANDLED]:
          "An error was captured by the global 'onerror' or 'onunhandledrejection' handler",
      };
    case 'apple-ios':
    case 'minidump':
    case 'native':
      return {
        ...commonTermsDescription,
        ...desktopTermDescriptions,
      };
    case 'rust':
      return {
        ...commonTermsDescription,
        ...desktopTermDescriptions,
        [SessionTerm.CRASHED]: t('The application had an unrecovable error (a panic)'),
      };
    default:
      return {
        ...commonTermsDescription,
        [SessionTerm.CRASHED]: t('Number of users who experienced an unhandled error'),
        [SessionTerm.ABNORMAL]: t('An unknown session exit'),
        [SessionTerm.HEALTHY]: mobileTermsDescription.healthy,
        [SessionTerm.ERRORED]: mobileTermsDescription.errored,
        [SessionTerm.UNHANDLED]: mobileTermsDescription.unhandled,
      };
  }
}

export function getSessionTermDescription(
  term: SessionTerm,
  platform: PlatformKey | null
) {
  return getTermDescriptions(platform)[term];
}
