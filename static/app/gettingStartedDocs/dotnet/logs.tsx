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
      text: t('Send a test log from your app to verify logs are arriving in Sentry.'),
    },
    {
      type: 'code',
      language: 'csharp',
      code: `SentrySdk.Logger.LogInfo("A simple log message");
SentrySdk.Logger.LogError("A {0} log message", "formatted");`,
    },
  ],
});

export const logs: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Logs in .NET are supported in Sentry .NET SDK version [code:5.14.0] and above.',
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
            'To enable logging, you need to initialize the SDK with the [code:EnableLogs] option set to [code:true].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: `SentrySdk.Init(options =>
{
    options.Dsn = "${params.dsn.public}";
    // Enable logs to be sent to Sentry
    options.EnableLogs = true;
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
};
