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

export const metricsVerify = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition: params.isMetricsSelected,
  content: [
    {
      type: 'text',
      text: t(
        'Send test metrics from your app to verify metrics are arriving in Sentry.'
      ),
    },
    {
      type: 'code',
      language: 'csharp',
      code: `SentrySdk.Metrics.EmitCounter("button_click", 5,
    [new KeyValuePair<string, object>("browser", "Firefox"), new KeyValuePair<string, object>("app_version", "1.0.0")]);
SentrySdk.Metrics.EmitDistribution("page_load", 15.0, MeasurementUnit.Duration.Millisecond,
    [new KeyValuePair<string, object>("page", "/home")]);
SentrySdk.Metrics.EmitGauge("page_load", 15.0, MeasurementUnit.Duration.Millisecond,
    [new KeyValuePair<string, object>("page", "/home")]);
`,
    },
    {
      type: 'text',
      text: tct('For more detailed information, see the [link:metrics documentation].', {
        link: <ExternalLink href="https://docs.sentry.io/platforms/dotnet/metrics/" />,
      }),
    },
  ],
});

const METRICS_EMIT_SNIPPET = `SentrySdk.Metrics.EmitCounter("button_click", 5,
    [new KeyValuePair<string, object>("browser", "Firefox"), new KeyValuePair<string, object>("app_version", "1.0.0")]);
SentrySdk.Metrics.EmitDistribution("page_load", 15.0, MeasurementUnit.Duration.Millisecond,
    [new KeyValuePair<string, object>("page", "/home")]);
SentrySdk.Metrics.EmitGauge("page_load", 15.0, MeasurementUnit.Duration.Millisecond,
    [new KeyValuePair<string, object>("page", "/home")]);`;

/**
 * @param hostInitializesSdk For platforms where the host starts Sentry, through
 * `UseSentry` or a startup class. The verify step then leaves out `SentrySdk.Init`, which
 * would initialize the SDK a second time.
 * @param sdkPackage The NuGet package the platform's onboarding installs, when that isn't
 * `Sentry`. Installing `Sentry` at a newer major version than the platform's package
 * breaks the app, at build or at startup.
 */
export const metrics = ({
  hostInitializesSdk,
  sdkPackage,
}: {
  hostInitializesSdk?: boolean;
  sdkPackage?: DotNetSdkPackage;
} = {}): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install our .NET SDK with a minimum version that supports metrics ([code:6.3.0] or higher).',
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
  configure: () => [],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
        ...(hostInitializesSdk
          ? ([
              {
                type: 'text',
                text: tct(
                  'Metrics are enabled by default. Emit them with the [code:SentrySdk.Metrics] API:',
                  {
                    code: <code />,
                  }
                ),
              },
              {
                type: 'code',
                language: 'csharp',
                code: METRICS_EMIT_SNIPPET,
              },
            ] satisfies ContentBlock[])
          : ([
              {
                type: 'text',
                text: tct(
                  'Metrics are automatically enabled in your [code:SentrySdk.Init] configuration. You can emit metrics using the [code:SentrySdk.Metrics] API.',
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

${METRICS_EMIT_SNIPPET}`,
              },
            ] satisfies ContentBlock[])),
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
});
