import {getJavascriptFullStackOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

export const profiling = getJavascriptFullStackOnboarding({
  packageName: '@sentry/sveltekit',
  browserProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/sveltekit/profiling/browser-profiling/',
  nodeProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/sveltekit/profiling/node-profiling/',
});
