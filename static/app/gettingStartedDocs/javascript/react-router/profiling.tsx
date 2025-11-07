import {getJavascriptFullStackOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

export const profiling = getJavascriptFullStackOnboarding({
  packageName: '@sentry/react-router',
  browserProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/react-router/profiling/browser-profiling/',
  nodeProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/react-router/profiling/node-profiling/',
});
