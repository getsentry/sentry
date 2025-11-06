import {getJavascriptMetricsOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

import {installSnippetBlock} from './utils';

export const metrics = getJavascriptMetricsOnboarding({
  installSnippetBlock,
  docsPlatform: 'ember',
  packageName: '@sentry/ember',
});
