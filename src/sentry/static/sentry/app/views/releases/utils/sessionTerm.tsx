import {PlatformKey} from 'app/data/platformCategories';
import {t} from 'app/locale';

const commonTermsDescription = {
  crashes: t('Number of sessions with a crashed state'),
  'crash-free-users': t('Number of unique users with non-crashed sessions'),
  'crash-free-sessions': t('Number of non-crashed sessions'),
};

const mobileTermsDescription = {
  crashed: t(
    'The process was terminated due to an unhandled exception or a request to the server that ended with an error'
  ),
  'crash-free-sessions': t('Number of unique sessions that did not experience a crash'),
  abnormal: t(
    'An unknown session exit. Like due to loss of power or killed by the operating system'
  ),
  healthy: t('A session without any errors'),
  errored: t('A crash which experienced errors'),
  unhandled: t('Not handled by user code'),
};

const desktopTermDescriptions = {
  crashed: t('The application crashed with a hard crashed (eg. segfault)'),
  abnormal: t(
    'The application did not properly end the session, for example, due to force-quit'
  ),
  healthy: t('The application exited normally and did not observe any errors'),
  errored: t('The application exited normally but observed error events while running'),
  unhandled: t('The application crashed with a hard crashed'),
};

function getTermDescriptions(platform: PlatformKey | null) {
  const technology = platform?.includes('javascript') ? platform.split('-')[0] : platform;

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
        crashes: t(
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
        crashed: t('An unhandled exception that resulted in the application crashing'),
      };

    case 'apple': {
      return {
        ...commonTermsDescription,
        ...mobileTermsDescription,
        crashed: t('An error that resulted in the application crashing'),
      };
    }
    case 'node':
    case 'javascript':
      return {
        ...commonTermsDescription,
        crashed: t(
          "During session an error with mechanism.handled===false occured which is 'onerror' on 'unhandledrejection' handler"
        ),
        abnormal: t('Non applicable for Javascript'),
        healthy: t('No errors captured during session life-time'),
        errored: t(
          'During the session at least one error occurred that did not bubble up to the global handlers, not resulting in the application loading process crashing.'
        ),
        unhandled:
          "An error bubbled up to the global 'onerror' or 'onunhandledrejection' handler",
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
        crashed: t('The application had an unrecovable error (a panic)'),
      };
    default:
      return {
        ...commonTermsDescription,
        crashed: t('Number of users who experienced an unhandled error'),
        abnormal: t('An unknown session exit'),
        healthy: mobileTermsDescription.healthy,
        errored: mobileTermsDescription.errored,
        unhandled: mobileTermsDescription.unhandled,
      };
  }
}

type Term = keyof ReturnType<typeof getTermDescriptions>;

export function getSessionTermDescription(term: Term, platform: PlatformKey) {
  return getTermDescriptions(platform)[term];
}
