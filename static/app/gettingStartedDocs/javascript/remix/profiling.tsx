import {getJavascriptFullStackOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

export const profiling = getJavascriptFullStackOnboarding({
  packageName: '@sentry/remix',
  browserProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/remix/profiling/browser-profiling/',
  nodeProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/remix/profiling/node-profiling/',
});
