import {getJavascriptLogsOnboarding} from 'sentry/utils/gettingStartedDocs/javascript';

import {installSnippetBlock} from './utils';

export const logs = getJavascriptLogsOnboarding({
  installSnippetBlock,
  docsPlatform: 'vue',
  packageName: '@sentry/vue',
});
