import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import type {StepProps} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
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
    Sentry.metrics.metricsAggregatorIntegration(),
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
        'You need a minimum version [codeVersion:7.103.0] of the Sentry browser SDK package, or an equivalent framework SDK (e.g. [codePackage:@sentry/react]) installed.',
        {
          codeVersion: <code />,
          codePackage: <code />,
        }
      ),
      configurations: getInstallConfig(params),
    },
  ],
  configure: getJSMetricsOnboardingConfigure,
  verify: () =>
    getJSMetricsOnboardingVerify({
      docsLink: 'https://docs.sentry.io/platforms/javascript/metrics/',
    }),
});

export const getReactNativeMetricsOnboarding = ({
  getInstallConfig,
}: {
  getInstallConfig: (params: DocsParams<any>) => StepProps['configurations'];
}): OnboardingConfig => ({
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version [codeVersion:5.19.0] of the Sentry React Native SDK installed.',
        {
          codeVersion: <code />,
        }
      ),
      configurations: getInstallConfig(params),
    },
  ],
  configure: getJSMetricsOnboardingConfigure,
  verify: () =>
    getJSMetricsOnboardingVerify({
      docsLink: 'https://docs.sentry.io/platforms/react-native/metrics/',
    }),
});

const getJSMetricsOnboardingConfigure = (params: DocsParams) => [
  {
    type: StepType.CONFIGURE,
    description: tct(
      'To enable capturing metrics, you first need to add the metrics aggregator integration under the [codeNamespace:Sentry.metrics] namespace.',
      {
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
];

const getJSMetricsOnboardingVerify = ({docsLink}: {docsLink: string}) => [
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
            docsLink: <ExternalLink href={docsLink} />,
          }
        ),
      },
    ],
  },
];

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
        'You need a minimum version [codeVersion:7.103.0] of [codeNode:@sentry/node], [codeDeno:@sentry/deno] or [codeBun:@sentry/bun].',
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
                <ExternalLink href="https://docs.sentry.io/platforms/node/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
});

const getJvmKotlinConfigureSnippet = (params: DocsParams) => `
import io.sentry.Sentry

Sentry.init(this) { options ->
  options.dsn = "${params.dsn}",
  options.enableMetrics = true
}`;

const getJvmJavaConfigureSnippet = (params: DocsParams) => `
import io.sentry.Sentry;

Sentry.init(this, options -> {
  options.setDsn("${params.dsn}");
  options.setEnableMetrics(true);
});`;

const getAndroidKotlinConfigureSnippet = (params: DocsParams) => `
import io.sentry.android.core.SentryAndroid

SentryAndroid.init(this) { options ->
  options.dsn = "${params.dsn}",
  options.enableMetrics = true
}`;

const getAndroidJavaConfigureSnippet = (params: DocsParams) => `
import io.sentry.android.core.SentryAndroid;

SentryAndroid.init(this, options -> {
  options.setDsn("${params.dsn}");
  options.setEnableMetrics(true);
});`;

const getAndroidXmlConfigureSnippet = (params: DocsParams) => `
<manifest>
    <application>
        <meta-data android:name="io.sentry.dsn" android:value="${params.dsn}" />
        <meta-data android:name="io.sentry.enable-metrics" android:value="true" />
    </application>
</manifest>`;

const getJvmPropertiesConfigureSnippet = (_: DocsParams) => `
sentry.enable-metrics=true`;

const getJvmJavaVerifySnippet = () => `
// Add 4 to a counter named "hits"
Sentry.metrics().increment("hits", 4);`;

const getJvmKotlinVerifySnippet = () => `
// Add 4 to a counter named "hits"
Sentry.metrics().increment("hits", 4)`;

export const getAndroidMetricsOnboarding = (): OnboardingConfig => ({
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need [package:sentry-java] version [codeVersion:7.6.0] or higher. Follow our [docsLink:setup wizard] to learn more about setting up the Android SDK.',
        {
          package: <code />,
          codeVersion: <code />,
          docsLink: <Link to={`/projects/${params.projectSlug}/getting-started/`} />,
        }
      ),
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      description: 'To enable capturing metrics, you need to enable the metrics feature.',
      configurations: [
        {
          code: [
            {
              label: 'Kotlin',
              value: 'java',
              language: 'java',
              code: getAndroidKotlinConfigureSnippet(params),
            },
            {
              label: 'Java',
              value: 'kotlin',
              language: 'java',
              code: getAndroidJavaConfigureSnippet(params),
            },
            {
              label: 'XML',
              value: 'xml',
              language: 'java',
              code: getAndroidXmlConfigureSnippet(params),
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
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges]. These are available under the [codeNamespace:Sentry.metrics()] namespace. Try out this example:",
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
          configurations: [
            {
              code: [
                {
                  label: 'Kotlin',
                  value: 'kotlin',
                  language: 'java',
                  code: getJvmKotlinVerifySnippet(),
                },
                {
                  label: 'Java',
                  value: 'java',
                  language: 'java',
                  code: getJvmJavaVerifySnippet(),
                },
              ],
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
                <ExternalLink href="https://docs.sentry.io/platforms/android/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
});

export const getJavaMetricsOnboarding = (): OnboardingConfig => ({
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need [package:sentry-java] version [codeVersion:7.6.0] or higher. Follow our [docsLink:setup wizard] to learn more about setting up the Java SDK.',
        {
          package: <code />,
          codeVersion: <code />,
          docsLink: <Link to={`/projects/${params.projectSlug}/getting-started`} />,
        }
      ),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: 'To enable capturing metrics, you need to enable the metrics feature.',
      configurations: [
        {
          code: [
            {
              label: 'Java',
              value: 'java',
              language: 'java',
              code: getJvmJavaConfigureSnippet(params),
            },
            {
              label: 'Kotlin',
              value: 'kotlin',
              language: 'java',
              code: getJvmKotlinConfigureSnippet(params),
            },
            {
              label: 'properties',
              value: 'properties',
              language: 'properties',
              code: getJvmPropertiesConfigureSnippet(params),
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
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges]. These are available under the [codeNamespace:Sentry.metrics()] namespace. Try out this example:",
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
          configurations: [
            {
              code: [
                {
                  label: 'Java',
                  value: 'java',
                  language: 'java',
                  code: getJvmJavaVerifySnippet(),
                },
                {
                  label: 'Kotlin',
                  value: 'kotlin',
                  language: 'java',
                  code: getJvmKotlinVerifySnippet(),
                },
              ],
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
                <ExternalLink href="https://docs.sentry.io/platforms/java/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
});

const getPythonConfigureSnippet = (params: DocsParams) => `
import sentry_sdk

sentry_sdk.init(
  dsn="${params.dsn}",
  # ...
)`;

const getPythonVerifySnippet = () => `
# Increment a metric to see how it works
sentry_sdk.metrics.incr("drank-drinks", 1, tags={"kind": "coffee"})`;

export const getPythonMetricsOnboarding = ({
  installSnippet,
}: {
  installSnippet: string;
}): OnboardingConfig => ({
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        "You need a minimum version [codeVersion:1.40.6] of the [codePackage:sentry-python] SDK and add that as your dependency. You don't need to install any additional packages",
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
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Once the SDK is installed you are ready to go. With the default snippet in place, there's no need for any further configuration."
      ),
      configurations: [
        {
          code: [
            {
              label: 'Python',
              value: 'python',
              language: 'python',
              code: getPythonConfigureSnippet(params),
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
                <ExternalLink href="https://docs.sentry.io/platforms/python/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
});

const getDotnetConfigureSnippet = (params: DocsParams) => `
SentrySdk.Init(options =>
  {
    options.Dsn = "${params.dsn}";
    options.ExperimentalMetrics = new ExperimentalMetricsOptions
    {
      EnableCodeLocations = true
    };
  });`;

const getDotnetVerifySnippet = () => `
SentrySdk.Metrics.Increment(
  "drank-drinks",
  tags:new Dictionary<string, string> {{"kind", "coffee"}}
);`;

export const getDotnetMetricsOnboarding = ({
  packageName,
}: {
  packageName: string;
}): OnboardingConfig => ({
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version [codeVersion:4.0.0] of the .NET SDK installed',
        {
          codeVersion: <code />,
        }
      ),
      configurations: [
        {
          language: 'powershell',
          code: `dotnet add package ${packageName} -v 4.1.2`,
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'Once the SDK is installed or updated, you can enable the experimental metrics feature and code locations being emitted in your SDK init.'
      ),
      configurations: [
        {
          language: 'csharp',
          code: getDotnetConfigureSnippet(params),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], [codeGauge:gauges], and [codeTimings:timings]. Try out this example:",
        {
          codeCounters: <code />,
          codeSets: <code />,
          codeDistribution: <code />,
          codeGauge: <code />,
          codeTimings: <code />,
        }
      ),
      configurations: [
        {
          language: 'csharp',
          code: getDotnetVerifySnippet(),
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
                <ExternalLink href="https://docs.sentry.io/platforms/dotnet/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
});

const getRubyConfigureSnippet = () => `
Sentry.init do |config|
  # ...
  config.metrics.enabled = true
end`;

const getRubyVerifySnippet = () => `
# Increment a metric to see how it works
Sentry::Metrics.increment("drank-drinks", 1, tags: { kind: "coffee" })`;

export const getRubyMetricsOnboarding = (): OnboardingConfig => ({
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version [codeVersion:5.17.0] of the [codePackage:sentry-ruby] gem and add that as your dependency in your [codeGemfile:Gemfile].',
        {
          codeVersion: <code />,
          codePackage: <code />,
          codeGemfile: <code />,
        }
      ),
      configurations: [
        {
          language: 'ruby',
          code: 'gem "sentry-ruby"',
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'Once the SDK is installed or updated you have to enable metrics in your SDK initializer:'
      ),
      configurations: [
        {
          code: [
            {
              label: 'Ruby',
              value: 'ruby',
              language: 'ruby',
              code: getRubyConfigureSnippet(),
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
              label: 'Ruby',
              value: 'ruby',
              language: 'ruby',
              code: getRubyVerifySnippet(),
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
                <ExternalLink href="https://docs.sentry.io/platforms/ruby/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
});
