import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getInstallSnippetCoreCli,
  getInstallSnippetPackageManager,
} from 'sentry/gettingStartedDocs/dotnet/utils';
import {t, tct} from 'sentry/locale';

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

export const logs = (): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install our .NET SDK with a minimum version that supports logs ([code:6.0.0] or higher).',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Package Manager',
              language: 'shell',
              code: getInstallSnippetPackageManager(params),
            },
            {
              label: '.NET Core CLI',
              language: 'shell',
              code: getInstallSnippetCoreCli(params),
            },
          ],
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Configure the Sentry SDK to capture logs by setting [code:EnableLogs=true] in your [code:SentrySdk.Init] call:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'dotnet',
          code: `using Sentry;

SentrySdk.Init(o => {
    o.Dsn = "${params.dsn.public}";
    // Enable logs to be sent to Sentry
    o.EnableLogs = true;
});`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information on logging configuration, see the [link:logs documentation].',
            {
              link: <ExternalLink href="https://docs.sentry.io/platforms/dotnet/logs/" />,
            }
          ),
        },
      ],
    },
  ],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      description: t('Test that logs are working by sending some test logs:'),
      content: [logsVerify(params)],
    },
  ],
});
