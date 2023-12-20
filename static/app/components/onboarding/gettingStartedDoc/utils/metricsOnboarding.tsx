import {StepProps, StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const getJSInstallSnippet = (params: DocsParams) => `
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
              code: getJSInstallSnippet(params),
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
            'With a bit of delay you can see the data appear in the Sentry UI'
          ),
        },
      ],
    },
  ],
});
