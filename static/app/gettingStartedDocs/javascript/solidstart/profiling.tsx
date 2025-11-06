import {getJavascriptProfilingOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

import {installSnippetBlock} from './utils';

export const profiling = getJavascriptProfilingOnboarding({
  installSnippetBlock,
  docsLink:
    'https://docs.sentry.io/platforms/javascript/guides/solidstart/profiling/browser-profiling/',
});
