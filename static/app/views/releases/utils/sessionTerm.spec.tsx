import {
  commonTermsDescription,
  desktopTermDescriptions,
  getSessionTermDescription,
  mobileTermsDescription,
  SessionTerm,
} from 'sentry/views/releases/utils/sessionTerm';

describe('Release Health Session Term', function () {
  it('dotnet terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(SessionTerm.CRASHES, 'dotnet');
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(SessionTerm.CRASHED, 'dotnet');
    expect(crashedSessionTerm).toEqual(mobileTermsDescription.crashed);

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'dotnet'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'dotnet'
    );
    expect(crashFreeSessionTerm).toEqual(mobileTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(SessionTerm.ABNORMAL, 'dotnet');
    expect(abnormalSessionTerm).toEqual(mobileTermsDescription.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(SessionTerm.HEALTHY, 'dotnet');
    expect(healthySessionTerm).toEqual(mobileTermsDescription.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(SessionTerm.ERRORED, 'dotnet');
    expect(erroredSessionTerm).toEqual(mobileTermsDescription.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'dotnet'
    );
    expect(unhandledSessionTerm).toEqual(mobileTermsDescription.unhandled);
  });

  it('java terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(SessionTerm.CRASHES, 'java');
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(SessionTerm.CRASHED, 'java');
    expect(crashedSessionTerm).toEqual(mobileTermsDescription.crashed);

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'java'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'java'
    );
    expect(crashFreeSessionTerm).toEqual(mobileTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(SessionTerm.ABNORMAL, 'java');
    expect(abnormalSessionTerm).toEqual(mobileTermsDescription.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(SessionTerm.HEALTHY, 'java');
    expect(healthySessionTerm).toEqual(mobileTermsDescription.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(SessionTerm.ERRORED, 'java');
    expect(erroredSessionTerm).toEqual(mobileTermsDescription.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(SessionTerm.UNHANDLED, 'java');
    expect(unhandledSessionTerm).toEqual(mobileTermsDescription.unhandled);
  });

  it('java-spring terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHES,
      'java-spring'
    );
    expect(crashesSessionTerm).toBe(
      'A request that resulted in an unhandled exception and hence a Server Error response'
    );

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHED,
      'java-spring'
    );
    expect(crashedSessionTerm).toEqual(mobileTermsDescription.crashed);

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'java-spring'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'java-spring'
    );
    expect(crashFreeSessionTerm).toEqual(mobileTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(
      SessionTerm.ABNORMAL,
      'java-spring'
    );
    expect(abnormalSessionTerm).toEqual(mobileTermsDescription.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(
      SessionTerm.HEALTHY,
      'java-spring'
    );
    expect(healthySessionTerm).toEqual(mobileTermsDescription.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(
      SessionTerm.ERRORED,
      'java-spring'
    );
    expect(erroredSessionTerm).toEqual(mobileTermsDescription.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'java-spring'
    );
    expect(unhandledSessionTerm).toEqual(mobileTermsDescription.unhandled);
  });

  it('dotnet-aspnetcore terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHES,
      'dotnet-aspnetcore'
    );
    expect(crashesSessionTerm).toBe(
      'A request that resulted in an unhandled exception and hence a Server Error response'
    );

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHED,
      'dotnet-aspnetcore'
    );
    expect(crashedSessionTerm).toEqual(mobileTermsDescription.crashed);

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'dotnet-aspnetcore'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'dotnet-aspnetcore'
    );
    expect(crashFreeSessionTerm).toEqual(mobileTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(
      SessionTerm.ABNORMAL,
      'dotnet-aspnetcore'
    );
    expect(abnormalSessionTerm).toEqual(mobileTermsDescription.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(
      SessionTerm.HEALTHY,
      'dotnet-aspnetcore'
    );
    expect(healthySessionTerm).toEqual(mobileTermsDescription.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(
      SessionTerm.ERRORED,
      'dotnet-aspnetcore'
    );
    expect(erroredSessionTerm).toEqual(mobileTermsDescription.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'dotnet-aspnetcore'
    );
    expect(unhandledSessionTerm).toEqual(mobileTermsDescription.unhandled);
  });

  it('android terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(SessionTerm.CRASHES, 'android');
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(SessionTerm.CRASHED, 'android');
    expect(crashedSessionTerm).toBe(
      'An unhandled exception that resulted in the application crashing'
    );

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'android'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'android'
    );
    expect(crashFreeSessionTerm).toEqual(mobileTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(
      SessionTerm.ABNORMAL,
      'android'
    );
    expect(abnormalSessionTerm).toEqual(mobileTermsDescription.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(SessionTerm.HEALTHY, 'android');
    expect(healthySessionTerm).toEqual(mobileTermsDescription.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(SessionTerm.ERRORED, 'android');
    expect(erroredSessionTerm).toEqual(mobileTermsDescription.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'android'
    );
    expect(unhandledSessionTerm).toEqual(mobileTermsDescription.unhandled);
  });

  it('cordova terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(SessionTerm.CRASHES, 'cordova');
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(SessionTerm.CRASHED, 'cordova');
    expect(crashedSessionTerm).toBe(
      'An unhandled exception that resulted in the application crashing'
    );

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'cordova'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'cordova'
    );
    expect(crashFreeSessionTerm).toEqual(mobileTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(
      SessionTerm.ABNORMAL,
      'cordova'
    );
    expect(abnormalSessionTerm).toEqual(mobileTermsDescription.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(SessionTerm.HEALTHY, 'cordova');
    expect(healthySessionTerm).toEqual(mobileTermsDescription.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(SessionTerm.ERRORED, 'cordova');
    expect(erroredSessionTerm).toEqual(mobileTermsDescription.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'cordova'
    );
    expect(unhandledSessionTerm).toEqual(mobileTermsDescription.unhandled);
  });

  it('react-native terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHES,
      'react-native'
    );
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHED,
      'react-native'
    );
    expect(crashedSessionTerm).toBe(
      'An unhandled exception that resulted in the application crashing'
    );

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'react-native'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'react-native'
    );
    expect(crashFreeSessionTerm).toEqual(mobileTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(
      SessionTerm.ABNORMAL,
      'react-native'
    );
    expect(abnormalSessionTerm).toEqual(mobileTermsDescription.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(
      SessionTerm.HEALTHY,
      'react-native'
    );
    expect(healthySessionTerm).toEqual(mobileTermsDescription.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(
      SessionTerm.ERRORED,
      'react-native'
    );
    expect(erroredSessionTerm).toEqual(mobileTermsDescription.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'react-native'
    );
    expect(unhandledSessionTerm).toEqual(mobileTermsDescription.unhandled);
  });

  it('flutter terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(SessionTerm.CRASHES, 'flutter');
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(SessionTerm.CRASHED, 'flutter');
    expect(crashedSessionTerm).toBe(
      'An unhandled exception that resulted in the application crashing'
    );

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'flutter'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'flutter'
    );
    expect(crashFreeSessionTerm).toEqual(mobileTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(
      SessionTerm.ABNORMAL,
      'flutter'
    );
    expect(abnormalSessionTerm).toEqual(mobileTermsDescription.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(SessionTerm.HEALTHY, 'flutter');
    expect(healthySessionTerm).toEqual(mobileTermsDescription.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(SessionTerm.ERRORED, 'flutter');
    expect(erroredSessionTerm).toEqual(mobileTermsDescription.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'flutter'
    );
    expect(unhandledSessionTerm).toEqual(mobileTermsDescription.unhandled);
  });

  it('apple terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHES,
      'apple-macos'
    );
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHED,
      'apple-macos'
    );
    expect(crashedSessionTerm).toBe('An error that resulted in the application crashing');

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'apple-macos'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'apple-macos'
    );
    expect(crashFreeSessionTerm).toEqual(mobileTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(
      SessionTerm.ABNORMAL,
      'apple-macos'
    );
    expect(abnormalSessionTerm).toEqual(mobileTermsDescription.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(
      SessionTerm.HEALTHY,
      'apple-macos'
    );
    expect(healthySessionTerm).toEqual(mobileTermsDescription.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(
      SessionTerm.ERRORED,
      'apple-macos'
    );
    expect(erroredSessionTerm).toEqual(mobileTermsDescription.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'apple-macos'
    );
    expect(unhandledSessionTerm).toEqual(mobileTermsDescription.unhandled);
  });

  it('apple anr rate', function () {
    const anrRateSessionTerm = getSessionTermDescription(SessionTerm.ANR_RATE, 'apple');
    expect(anrRateSessionTerm).toBe(
      'Percentage of unique users that experienced an App Hang error.'
    );

    const anrRateSessionTermiOS = getSessionTermDescription(
      SessionTerm.ANR_RATE,
      'apple-ios'
    );
    expect(anrRateSessionTermiOS).toBe(
      'Percentage of unique users that experienced an App Hang error.'
    );
  });

  it('node-express terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHES,
      'node-express'
    );
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHED,
      'node-express'
    );
    expect(crashedSessionTerm).toBe(
      'During the session an unhandled global error/promise rejection occurred.'
    );

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'node-express'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'node-express'
    );
    expect(crashFreeSessionTerm).toEqual(commonTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(
      SessionTerm.ABNORMAL,
      'node-express'
    );
    expect(abnormalSessionTerm).toBe('Non applicable for Javascript.');

    // Healthy
    const healthySessionTerm = getSessionTermDescription(
      SessionTerm.HEALTHY,
      'node-express'
    );
    expect(healthySessionTerm).toBe('No errors were captured during session life-time.');

    // Errored
    const erroredSessionTerm = getSessionTermDescription(
      SessionTerm.ERRORED,
      'node-express'
    );
    expect(erroredSessionTerm).toBe(
      'During the session at least one handled error occurred.'
    );

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'node-express'
    );
    expect(unhandledSessionTerm).toBe(
      "An error was captured by the global 'onerror' or 'onunhandledrejection' handler."
    );
  });

  it('javascript terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHES,
      'javascript'
    );
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHED,
      'javascript'
    );
    expect(crashedSessionTerm).toBe(
      'During the session an unhandled global error/promise rejection occurred.'
    );

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'javascript'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'javascript'
    );
    expect(crashFreeSessionTerm).toEqual(commonTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(
      SessionTerm.ABNORMAL,
      'javascript'
    );
    expect(abnormalSessionTerm).toBe('Non applicable for Javascript.');

    // Healthy
    const healthySessionTerm = getSessionTermDescription(
      SessionTerm.HEALTHY,
      'javascript'
    );
    expect(healthySessionTerm).toBe('No errors were captured during session life-time.');

    // Errored
    const erroredSessionTerm = getSessionTermDescription(
      SessionTerm.ERRORED,
      'javascript'
    );
    expect(erroredSessionTerm).toBe(
      'During the session at least one handled error occurred.'
    );

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'javascript'
    );
    expect(unhandledSessionTerm).toBe(
      "An error was captured by the global 'onerror' or 'onunhandledrejection' handler."
    );
  });

  it('rust terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(SessionTerm.CRASHES, 'rust');
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(SessionTerm.CRASHED, 'rust');
    expect(crashedSessionTerm).toBe(
      'The application had an unrecoverable error (a panic)'
    );

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'rust'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'rust'
    );
    expect(crashFreeSessionTerm).toEqual(commonTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(SessionTerm.ABNORMAL, 'rust');
    expect(abnormalSessionTerm).toEqual(desktopTermDescriptions.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(SessionTerm.HEALTHY, 'rust');
    expect(healthySessionTerm).toEqual(desktopTermDescriptions.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(SessionTerm.ERRORED, 'rust');
    expect(erroredSessionTerm).toEqual(desktopTermDescriptions.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(SessionTerm.UNHANDLED, 'rust');
    expect(unhandledSessionTerm).toEqual(desktopTermDescriptions.unhandled);
  });

  it('apple-ios terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHES,
      'apple-ios'
    );
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(
      SessionTerm.CRASHED,
      'apple-ios'
    );
    expect(crashedSessionTerm).toEqual(desktopTermDescriptions.crashed);

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'apple-ios'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'apple-ios'
    );
    expect(crashFreeSessionTerm).toEqual(commonTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(
      SessionTerm.ABNORMAL,
      'apple-ios'
    );
    expect(abnormalSessionTerm).toEqual(desktopTermDescriptions.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(
      SessionTerm.HEALTHY,
      'apple-ios'
    );
    expect(healthySessionTerm).toEqual(desktopTermDescriptions.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(
      SessionTerm.ERRORED,
      'apple-ios'
    );
    expect(erroredSessionTerm).toEqual(desktopTermDescriptions.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'apple-ios'
    );
    expect(unhandledSessionTerm).toEqual(desktopTermDescriptions.unhandled);
  });

  it('minidump terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(SessionTerm.CRASHES, 'minidump');
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(SessionTerm.CRASHED, 'minidump');
    expect(crashedSessionTerm).toEqual(desktopTermDescriptions.crashed);

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'minidump'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'minidump'
    );
    expect(crashFreeSessionTerm).toEqual(commonTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(
      SessionTerm.ABNORMAL,
      'minidump'
    );
    expect(abnormalSessionTerm).toEqual(desktopTermDescriptions.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(SessionTerm.HEALTHY, 'minidump');
    expect(healthySessionTerm).toEqual(desktopTermDescriptions.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(SessionTerm.ERRORED, 'minidump');
    expect(erroredSessionTerm).toEqual(desktopTermDescriptions.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'minidump'
    );
    expect(unhandledSessionTerm).toEqual(desktopTermDescriptions.unhandled);
  });

  it('native terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(SessionTerm.CRASHES, 'native');
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(SessionTerm.CRASHED, 'native');
    expect(crashedSessionTerm).toEqual(desktopTermDescriptions.crashed);

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'native'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'native'
    );
    expect(crashFreeSessionTerm).toEqual(commonTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(SessionTerm.ABNORMAL, 'native');
    expect(abnormalSessionTerm).toEqual(desktopTermDescriptions.abnormal);

    // Healthy
    const healthySessionTerm = getSessionTermDescription(SessionTerm.HEALTHY, 'native');
    expect(healthySessionTerm).toEqual(desktopTermDescriptions.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(SessionTerm.ERRORED, 'native');
    expect(erroredSessionTerm).toEqual(desktopTermDescriptions.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'native'
    );
    expect(unhandledSessionTerm).toEqual(desktopTermDescriptions.unhandled);
  });

  it('python terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(SessionTerm.CRASHES, 'python');
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(SessionTerm.CRASHED, 'python');
    expect(crashedSessionTerm).toBe('Number of users who experienced an unhandled error');

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      'python'
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      'python'
    );
    expect(crashFreeSessionTerm).toEqual(commonTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(SessionTerm.ABNORMAL, 'python');
    expect(abnormalSessionTerm).toBe('An unknown session exit');

    // Healthy
    const healthySessionTerm = getSessionTermDescription(SessionTerm.HEALTHY, 'python');
    expect(healthySessionTerm).toEqual(mobileTermsDescription.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(SessionTerm.ERRORED, 'python');
    expect(erroredSessionTerm).toEqual(mobileTermsDescription.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(
      SessionTerm.UNHANDLED,
      'python'
    );
    expect(unhandledSessionTerm).toEqual(mobileTermsDescription.unhandled);
  });

  it('default terms', function () {
    // Crashes
    const crashesSessionTerm = getSessionTermDescription(SessionTerm.CRASHES, null);
    expect(crashesSessionTerm).toEqual(commonTermsDescription.crashes);

    // Crashed
    const crashedSessionTerm = getSessionTermDescription(SessionTerm.CRASHED, null);
    expect(crashedSessionTerm).toBe('Number of users who experienced an unhandled error');

    // Crash Free Users
    const crashFreeUsersSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_USERS,
      null
    );
    expect(crashFreeUsersSessionTerm).toEqual(commonTermsDescription['crash-free-users']);

    // Crash Free Sessions
    const crashFreeSessionTerm = getSessionTermDescription(
      SessionTerm.CRASH_FREE_SESSIONS,
      null
    );
    expect(crashFreeSessionTerm).toEqual(commonTermsDescription['crash-free-sessions']);

    // Abnormal
    const abnormalSessionTerm = getSessionTermDescription(SessionTerm.ABNORMAL, null);
    expect(abnormalSessionTerm).toBe('An unknown session exit');

    // Healthy
    const healthySessionTerm = getSessionTermDescription(SessionTerm.HEALTHY, null);
    expect(healthySessionTerm).toEqual(mobileTermsDescription.healthy);

    // Errored
    const erroredSessionTerm = getSessionTermDescription(SessionTerm.ERRORED, null);
    expect(erroredSessionTerm).toEqual(mobileTermsDescription.errored);

    // Unhandled
    const unhandledSessionTerm = getSessionTermDescription(SessionTerm.UNHANDLED, null);
    expect(unhandledSessionTerm).toEqual(mobileTermsDescription.unhandled);
  });
});
