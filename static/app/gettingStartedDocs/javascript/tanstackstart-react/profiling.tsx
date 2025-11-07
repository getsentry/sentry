import {getJavascriptFullStackOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

export const profiling = getJavascriptFullStackOnboarding({
  packageName: '@sentry/tanstackstart-react',
  browserProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/profiling/browser-profiling/',
  nodeProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/profiling/node-profiling/',
});
