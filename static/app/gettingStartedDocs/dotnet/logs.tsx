import {ExternalLink} from '@sentry/scraps/link';

import {
  StepType,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {
  getInstallSnippetCoreCli,
  getInstallSnippetPackageManager,
  type DotNetSdkPackage,
} from './utils';

/**
 * The `ILogger` a verify snippet logs through: `logger` stands for an `ILogger<T>` that
 * the user's class takes from dependency injection, and `app.Logger` is the
 * `WebApplication`'s logger.
 */
type DotNetLogger = 'logger' | 'app.Logger';

const getEnableLogsAppSettingsSnippet = (params: DocsParams) => `{
  "Sentry": {
    "Dsn": "${params.dsn.public}",
    // Send ILogger entries to Sentry as logs
    "EnableLogs": true
  }
}`;

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

/**
 * The second line logs a warning, not an error: `ILogger` entries at `Error` and above
 * also create an issue in Sentry, which a test log shouldn't.
 *
 * @param logger The `ILogger` to log through. For the default, `logger`, the text says
 * it is an `ILogger<T>` taken from dependency injection.
 */
export const loggerLogsVerify = (
  params: DocsParams,
  logger: DotNetLogger = 'logger'
): ContentBlock => ({
  type: 'conditional',
  condition: params.isLogsSelected,
  content: [
    {
      type: 'text',
      text:
        logger === 'logger'
          ? tct(
              'Send a test log through an [code:ILogger<T>] that your class takes from dependency injection, then refresh this page to verify it arrived in Sentry.',
              {
                code: <code />,
              }
            )
          : tct(
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
${logger}.LogWarning("A {Parameter} log message", "formatted");`,
    },
  ],
});

/**
 * @param logger For platforms that keep the `EnableLogs` opt-in, in the `UseSentry`
 * callback or in `appsettings.json`: the `ILogger` the verify snippet logs through. Leave
 * it out for platforms that call `SentrySdk.Init`.
 * @param sdkPackage The NuGet package the platform's onboarding installs, when that isn't
 * `Sentry`. Installing `Sentry` at a newer major version than the platform's package
 * breaks the app, at build or at startup.
 * @param docsGuide The docs guide whose logs page to link, for platforms that have one.
 * @param appSettingsOnly For platforms with a `logger` whose host has no `UseSentry`
 * callback, so the `EnableLogs` opt-in can only go in `appsettings.json`.
 */
export const logs = ({
  logger,
  sdkPackage,
  docsGuide,
  appSettingsOnly,
}: {
  appSettingsOnly?: boolean;
  docsGuide?: string;
  logger?: DotNetLogger;
  sdkPackage?: DotNetSdkPackage;
} = {}): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Logs in .NET are supported in Sentry .NET SDK version [code:6.0.0] and above.',
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
              code: getInstallSnippetPackageManager(params, sdkPackage),
            },
            {
              label: '.NET Core CLI',
              language: 'shell',
              code: getInstallSnippetCoreCli(params, sdkPackage),
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
                text: appSettingsOnly
                  ? tct(
                      'To send the entries your app writes through [code:ILogger] to Sentry as logs, set [code:EnableLogs] to [code:true] in the [code:Sentry] section of [code:appsettings.json]:',
                      {
                        code: <code />,
                      }
                    )
                  : tct(
                      'To send the entries your app writes through [code:ILogger] to Sentry as logs, set [code:EnableLogs] to [code:true] in the [code:UseSentry] callback:',
                      {
                        code: <code />,
                      }
                    ),
              },
              appSettingsOnly
                ? {
                    type: 'code',
                    language: 'json',
                    code: getEnableLogsAppSettingsSnippet(params),
                  }
                : {
                    type: 'code',
                    language: 'csharp',
                    code: `builder.UseSentry(options =>
{
    options.Dsn = "${params.dsn.public}";
    // Send ILogger entries to Sentry as logs
    options.EnableLogs = true;
});`,
                  },
            ] satisfies ContentBlock[])
          : ([
              {
                type: 'text',
                text: tct(
                  'From version [code:7.0.0] on, logs you send with [code:SentrySdk.Logger] need no extra option. [code:EnableLogs], which 6.x needs, is gone from [code:SentryOptions]: remove it when you upgrade. Initialize the SDK:',
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
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/dotnet/${docsGuide ? `guides/${docsGuide}/` : ''}logs/`}
                />
              ),
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
