import {getJavascriptMetricsOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

import {installSnippetBlock} from './utils';

export const metrics = getJavascriptMetricsOnboarding({
  installSnippetBlock,
  docsPlatform: 'svelte',
  packageName: '@sentry/svelte',
});
