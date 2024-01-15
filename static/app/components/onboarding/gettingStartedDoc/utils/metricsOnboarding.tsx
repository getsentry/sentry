import ExternalLink from 'sentry/components/links/externalLink';
import {StepProps, StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getInstallConfig as getNodeInstallConfig} from 'sentry/utils/gettingStartedDocs/node';

const getJSConfigureSnippet = (params: DocsParams) => `
Sentry.init({
  dsn: "${params.dsn}",
  integrations: [
    new Sentry.metrics.MetricsAggregator(),
  ],
});`;

const getJSVerifySnippet = () => `
// Add 4 to a counter named 'hits'
Sentry.metrics.increment('hits', 4);`;

export const getJSMetricsOnboarding = ({
  getInstallConfig,
}: {
  getInstallConfig: (params: DocsParams<any>) => StepProps['configurations'];
}): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version [codeVersion:7.88.0] of the Sentry browser SDK package, or an equivalent framework SDK (e.g. [codePackage:@sentry/react]) installed.',
        {
          codeVersion: <code />,
          codePackage: <code />,
        }
      ),
      configurations: getInstallConfig(params),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'To enable capturing metrics, you first need to add the [codeIntegration:MetricsAggregator] integration under the [codeNamespace:Sentry.metrics] namespace.',
        {
          codeIntegration: <code />,
          codeNamespace: <code />,
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getJSConfigureSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges]. These are available under the [codeNamespace:Sentry.metrics] namespace. Try out this example:",
        {
          codeCounters: <code />,
          codeSets: <code />,
          codeDistribution: <code />,
          codeGauge: <code />,
          codeNamespace: <code />,
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getJSVerifySnippet(),
            },
          ],
        },
        {
          description: t(
            'With a bit of delay you can see the data appear in the Sentry UI.'
          ),
        },
        {
          description: tct(
            'Learn more about metrics and how to configure them, by reading the [docsLink:docs].',
            {
              docsLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-javascript/discussions/9938" />
              ),
            }
          ),
        },
      ],
    },
  ],
});

const getJSServerConfigureSnippet = (params: DocsParams) => `
Sentry.init({
  dsn: "${params.dsn}",
  _experiments: {
    metricsAggregator: true,
  },
});`;

export const getJSServerMetricsOnboarding = (): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version [codeVersion:4.17.0] of [codeNode:@sentry/node], [codeDeno:@sentry/deno] or [codeBun:@sentry/bun].',
        {
          codeVersion: <code />,
          codeNode: <code />,
          codeDeno: <code />,
          codeBun: <code />,
        }
      ),
      configurations: getNodeInstallConfig(params),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'To enable capturing metrics, you first need to add the [codeIntegration:metricsAggregator] experiment to your [codeNamespace:Sentry.init] call in your main process.',
        {
          codeIntegration: <code />,
          codeNamespace: <code />,
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getJSServerConfigureSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges]. These are available under the [codeNamespace:Sentry.metrics] namespace. This API is available in both renderer and main processes. Try out this example:",
        {
          codeCounters: <code />,
          codeSets: <code />,
          codeDistribution: <code />,
          codeGauge: <code />,
          codeNamespace: <code />,
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getJSVerifySnippet(),
            },
          ],
        },
        {
          description: t(
            'With a bit of delay you can see the data appear in the Sentry UI.'
          ),
        },
        {
          description: tct(
            'Learn more about metrics and how to configure them, by reading the [docsLink:docs].',
            {
              docsLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-javascript/discussions/9973" />
              ),
            }
          ),
        },
      ],
    },
  ],
});

const getPythonConfigureSnippet = () => `
import sentry_sdk

sentry_sdk.init(
    ...
    _experiments={
        # Turns on the metrics module
        "enable_metrics": True,
        # Enables sending of code locations for metrics
        "metric_code_locations": True,
    },
)`;

const getPythonVerifySnippet = () => `
# Increment a metric to see how it works
metrics.incr("drank-drinks", 1, tags={"kind": "coffee"})`;

export const getPythonMetricsOnboarding = ({
  installSnippet,
}: {
  installSnippet: string;
}): OnboardingConfig => ({
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        "You need a minimum version [codeVersion:1.38.0] of the [codePackage:sentry-python] SDK and add that as your dependency. You don't need to install any additional packages",
        {
          codeVersion: <code />,
          codePackage: <code />,
        }
      ),
      configurations: [
        {
          language: 'bash',
          code: installSnippet,
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'Once the SDK is installed or updated you have to add experimental flag into your SDK init:'
      ),
      configurations: [
        {
          code: [
            {
              label: 'Python',
              value: 'python',
              language: 'python',
              code: getPythonConfigureSnippet(),
            },
          ],
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges]. Try out this example:",
        {
          codeCounters: <code />,
          codeSets: <code />,
          codeDistribution: <code />,
          codeGauge: <code />,
          codeNamespace: <code />,
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'Python',
              value: 'python',
              language: 'python',
              code: getPythonVerifySnippet(),
            },
          ],
        },
        {
          description: t(
            'With a bit of delay you can see the data appear in the Sentry UI.'
          ),
        },
        {
          description: tct(
            'Learn more about metrics and how to configure them, by reading the [docsLink:docs].',
            {
              docsLink: (
                <ExternalLink href="https://develop.sentry.dev/delightful-developer-metrics/sending-metrics-sdk/" />
              ),
            }
          ),
        },
      ],
    },
  ],
});
