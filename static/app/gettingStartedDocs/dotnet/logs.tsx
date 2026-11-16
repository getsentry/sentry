import {ExternalLink} from '@sentry/scraps/link';

import {
  StepType,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getInstallSnippetCoreCli, getInstallSnippetPackageManager} from './utils';

export const logsVerify = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition: params.isLogsSelected,
  content: [
    {
      type: 'text',
      text: t(
        'Send a test log from your app, then refresh this page to verify it arrived in Sentry.'
      ),
    },
    {
      type: 'code',
      language: 'csharp',
      code: `SentrySdk.Logger.LogInfo("A simple log message");
SentrySdk.Logger.LogError("A {0} log message", "formatted");`,
    },
  ],
});

export const loggerLogsVerify = (
  params: DocsParams,
  logger = 'logger'
): ContentBlock => ({
  type: 'conditional',
  condition: params.isLogsSelected,
  content: [
    {
      type: 'text',
      text: tct(
        'Send a test log through [code:ILogger] from your app, then refresh this page to verify it arrived in Sentry.',
        {
          code: <code />,
        }
      ),
    },
    {
      type: 'code',
      language: 'csharp',
      code: `${logger}.LogInformation("A simple log message");
${logger}.LogError("A {Parameter} log message", "formatted");`,
    },
  ],
});

/**
 * @param logger For platforms whose `UseSentry` options have `EnableLogs`: the `ILogger`
 * the verify snippet logs through. Leave it out for platforms that call `SentrySdk.Init`.
 */
export const logs = ({logger}: {logger?: string} = {}): OnboardingConfig => ({
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
        ...(logger
          ? ([
              {
                type: 'text',
                text: tct(
                  'To send the entries your app writes through [code:ILogger] to Sentry as logs, set [code:EnableLogs] to [code:true] in the options you pass to [code:UseSentry], or in the [code:Sentry] section of [code:appsettings.json].',
                  {
                    code: <code />,
                  }
                ),
              },
            ] satisfies ContentBlock[])
          : ([
              {
                type: 'text',
                text: tct(
                  'From version [code:7.0.0] on, logs you send with [code:SentrySdk.Logger] need no extra option. Initialize the SDK:',
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
});`,
              },
            ] satisfies ContentBlock[])),
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
      content: [logger ? loggerLogsVerify(params, logger) : logsVerify(params)],
    },
  ],
});
