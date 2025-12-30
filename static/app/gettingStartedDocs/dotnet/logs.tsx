import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const logs: OnboardingConfig = {
  install: () => [
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
            'To enable logging, you need to initialize the SDK with the [code:Experimental.EnableLogs] option set to [code:true].',
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
    options.Experimental.EnableLogs = true;
});`,
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Once the feature is enabled on the SDK and the SDK is initialized, you can send logs using the SentrySdk.Logger APIs.'
          ),
        },
        {
          type: 'text',
          text: t(
            'The SentrySdk.Logger instance exposes six methods that you can use to log messages at different log levels: Trace, Debug, Info, Warning, Error, and Fatal.'
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: `SentrySdk.Logger.LogInfo("A simple log message");
SentrySdk.Logger.LogError("A {0} log message", "formatted");`,
        },
        {
          type: 'text',
          text: tct(
            'You can also attach custom attributes via a delegate. For more information, see the [link:Integrations documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/dotnet/logs/#integrations" />
              ),
            }
          ),
        },
      ],
    },
  ],
};
