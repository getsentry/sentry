import {getJavascriptProfilingOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

import {installSnippetBlock} from './utils';

export const profiling = getJavascriptProfilingOnboarding({
  installSnippetBlock,
  docsLink:
    'https://docs.sentry.io/platforms/javascript/guides/react/profiling/browser-profiling/',
});
