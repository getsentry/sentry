import {getJavascriptFullStackOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

export const profiling = getJavascriptFullStackOnboarding({
  packageName: '@sentry/astro',
  browserProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/astro/profiling/browser-profiling/',
  nodeProfilingLink:
    'https://docs.sentry.io/platforms/javascript/guides/astro/profiling/node-profiling/',
});
