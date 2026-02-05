import {ExternalLink} from '@sentry/scraps/link';

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
import {tct} from 'sentry/locale';

export const metricsVerify = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition: params.isMetricsSelected,
  content: [
    {
      type: 'text',
      text: tct(
        'Send test metrics from your app to verify metrics are arriving in Sentry.',
        {code: <code />}
      ),
    },
    {
      type: 'code',
      language: 'csharp',
      code: `using Sentry;

SentrySdk.Experimental.Metrics.EmitCounter("button_click", 5,
    [new KeyValuePair<string, object>("browser", "Firefox"), new KeyValuePair<string, object>("app_version", "1.0.0")]);
SentrySdk.Experimental.Metrics.EmitDistribution("page_load", 15.0, SentryUnits.Duration.Millisecond,
    [new KeyValuePair<string, object>("page", "/home")]);
SentrySdk.Experimental.Metrics.EmitGauge("page_load", 15.0, SentryUnits.Duration.Millisecond,
    [new KeyValuePair<string, object>("page", "/home")]);
`,
    },
    {
      type: 'text',
      text: tct('For more detailed information, see the [link:metrics documentation].', {
        link: (
          <ExternalLink href="https://docs.sentry.io/platforms/dotnet/metrics/" />
        ),
      }),
    },
  ],
});

export const metrics: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install our .NET SDK with a minimum version that supports metrics ([code:6.1.0] or higher).',
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
  configure: () => [],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics are automatically enabled in your [code:SentrySdk.Init] configuration. You can emit metrics using the [code:SentrySdk.Experimental.Metrics] API.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: `using Sentry;

SentrySdk.Init(options =>
{
    options.Dsn = "${params.dsn.public}";
});

SentrySdk.Experimental.Metrics.EmitCounter("button_click", 5,
    [new KeyValuePair<string, object>("browser", "Firefox"), new KeyValuePair<string, object>("app_version", "1.0.0")]);
SentrySdk.Experimental.Metrics.EmitDistribution("page_load", 15.0, SentryUnits.Duration.Millisecond,
    [new KeyValuePair<string, object>("page", "/home")]);
SentrySdk.Experimental.Metrics.EmitGauge("page_load", 15.0, SentryUnits.Duration.Millisecond,
    [new KeyValuePair<string, object>("page", "/home")]);`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/dotnet/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
};
