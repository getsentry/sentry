import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getInstallSnippet = (params: Params) => `
[dependencies]
sentry = "${getPackageVersion(params, 'sentry.rust', '0.32.1')}"`;

const getInstallSnippetMetrics = (params: Params) => `
sentry = { version = "${getPackageVersion(
  params,
  'sentry.rust',
  '0.32.1'
)}", features = ["UNSTABLE_metrics"] }`;

const getConfigureSnippet = (params: Params) => `
let _guard = sentry::init(("${params.dsn}", sentry::ClientOptions {
  release: sentry::release_name!(),
  ..Default::default()
}));`;

const getVerifySnippet = (params: Params) => `
fn main() {
  let _guard = sentry::init(("${params.dsn}", sentry::ClientOptions {
    release: sentry::release_name!(),
    ..Default::default()
  }));

  // Sentry will capture this
  panic!("Everything is on fire!");
}`;

const getVerifySnippetMetrics = () => `
use sentry::metrics::Metric;

// Add 1 to a counter named 'hits'
Metric::count("hits").send();`;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'To add Sentry to your Rust project you just need to add a new dependency to your [code:Cargo.toml]:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'toml',
          partialLoading: params.sourcePackageRegistries.isLoading,
          code: getInstallSnippet(params),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        '[code:Sentry.init()] will return you a guard that when freed, will prevent process exit until all events have been sent (within a timeout):',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'rust',
          code: getConfigureSnippet(params),
        },
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      description: t(
        'The quickest way to verify Sentry in your Rust application is to cause a panic:'
      ),
      configurations: [
        {
          language: 'rust',
          code: getVerifySnippet(params),
        },
      ],
    },
  ],
};

const customMetricsOnboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need at least version 0.32.1 of the [codeSentry:sentry] or  [codeSentryCore:sentry-core] crates installed. Enable the [codeFeature:UNSTABLE_metrics] feature:',
        {
          codeSentry: <code />,
          codeSentryCore: <code />,
          codeSentryFeature: <code />,
        }
      ),
      configurations: [
        {
          language: 'toml',
          partialLoading: params.sourcePackageRegistries.isLoading,
          code: getInstallSnippetMetrics(params),
        },
      ],
    },
  ],
  configure: () => [],
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
              label: 'Rust',
              value: 'rust',
              language: 'rust',
              code: getVerifySnippetMetrics(),
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
                <ExternalLink href="https://docs.rs/sentry/latest/sentry/metrics/index.html" />
              ),
            }
          ),
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  customMetricsOnboarding,
};

export default docs;
