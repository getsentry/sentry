import {
  type ContentBlock,
  type DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

export const logsVerify = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition: params.isLogsSelected,
  content: [
    {
      type: 'text',
      text: t('Send test logs from your app to verify logs are arriving in Sentry.'),
    },
    {
      type: 'code',
      language: 'dotnet',
      code: `SentrySdk.Logger.LogInfo("A simple log message");
SentrySdk.Logger.LogError("A {0} log message", "formatted");`,
    },
  ],
});
