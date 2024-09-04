import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import type {StepProps} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import exampleSnippets from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsExampleSnippets';
import {t, tct} from 'sentry/locale';
import {getInstallConfig as getNodeInstallConfig} from 'sentry/utils/gettingStartedDocs/node';

const getJSConfigureSnippet = (params: DocsParams) => `
Sentry.init({
  dsn: "${params.dsn.public}",
  // Only needed for SDK versions < 8.0.0
  // integrations: [
  //   Sentry.metrics.metricsAggregatorIntegration(),
  // ],
});`;

const JSExampleConfig = {
  description: t('Try out these examples:'),
  code: [
    {
      label: 'Counter',
      value: 'counter',
      language: 'javascript',
      code: exampleSnippets.javascript.counter,
    },
    {
      label: 'Distribution',
      value: 'distribution',
      language: 'javascript',
      code: exampleSnippets.javascript.distribution,
    },
    {
      label: 'Set',
      value: 'set',
      language: 'javascript',
      code: exampleSnippets.javascript.set,
    },
    {
      label: 'Gauge',
      value: 'gauge',
      language: 'javascript',
      code: exampleSnippets.javascript.gauge,
    },
  ],
};

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
    description: t(
      'With the default snippet in place, there is no need for any further configuration.'
    ),
    configurations: [
      {
        code: getJSConfigureSnippet(params),
        language: 'javascript',
      },
    ],
  },
];

const getJSMetricsOnboardingVerify = ({docsLink}: {docsLink: string}) => [
  {
    type: StepType.VERIFY,
    description: tct(
      "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges]. These are available under the [codeNamespace:Sentry.metrics] namespace.",
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
        description: metricTagsExplanation,
      },
      JSExampleConfig,
      {
        description: t(
          'It can take up to 3 minutes for the data to appear in the Sentry UI.'
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
  dsn: "${params.dsn.public}",
  // Only needed for SDK versions < 8.0.0
  // _experiments: {
  //   metricsAggregator: true,
  // },
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
      description: t(
        'With the default snippet in place, there is no need for any further configuration.'
      ),
      configurations: [
        {
          code: getJSServerConfigureSnippet(params),
          language: 'javascript',
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges]. These are available under the [codeNamespace:Sentry.metrics] namespace. This API is available in both renderer and main processes.",
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
          description: metricTagsExplanation,
        },
        JSExampleConfig,
        {
          description: t(
            'It can take up to 3 minutes for the data to appear in the Sentry UI.'
          ),
        },
        {
          description: tct(
            'Learn more about metrics and how to configure them, by reading the [docsLink:docs].',
            {
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/metrics/" />
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
  options.dsn = "${params.dsn.public}",
  options.enableMetrics = true
}`;

const getJvmJavaConfigureSnippet = (params: DocsParams) => `
import io.sentry.Sentry;

Sentry.init(this, options -> {
  options.setDsn("${params.dsn.public}");
  options.setEnableMetrics(true);
});`;

const getAndroidKotlinConfigureSnippet = (params: DocsParams) => `
import io.sentry.android.core.SentryAndroid

SentryAndroid.init(this) { options ->
  options.dsn = "${params.dsn.public}",
  options.enableMetrics = true
}`;

const getAndroidJavaConfigureSnippet = (params: DocsParams) => `
import io.sentry.android.core.SentryAndroid;

SentryAndroid.init(this, options -> {
  options.setDsn("${params.dsn.public}");
  options.setEnableMetrics(true);
});`;

const getAndroidXmlConfigureSnippet = (params: DocsParams) => `
<manifest>
    <application>
        <meta-data android:name="io.sentry.dsn" android:value="${params.dsn.public}" />
        <meta-data android:name="io.sentry.enable-metrics" android:value="true" />
    </application>
</manifest>`;

const getJvmPropertiesConfigureSnippet = (_: DocsParams) => `
sentry.enable-metrics=true`;

const getJvmJavaVerifySnippet = () => `
final Map<String, String> tags = new HashMap<>();
tags.put("app-version", "1.0.0");

// Incrementing a counter by one for each button click.
Sentry.metrics().increment(
    "button_login_click", // key
    1.0,                  // value
    null,                 // unit
    tags                  // tags
);

// Add '150' to a distribution
// used to track the loading time of an image.
Sentry.metrics().distribution(
  "image_download_duration",
  150.0,
  MeasurementUnit.Duration.MILLISECOND,
  tags
);

// Add '15.0' to a gauge
// used for tracking the loading times for a page.
Sentry.metrics().gauge(
  "page_load",
  15.0,
  MeasurementUnit.Duration.MILLISECOND,
  tags
);

// Add 'jane' to a set
// used for tracking the number of users that viewed a page.
Sentry.metrics().set(
  "user_view",
  "jane",
  new MeasurementUnit.Custom("username"),
  tags
);

`;

const getJvmKotlinVerifySnippet = () => `
// Incrementing a counter by one for each button click.
Sentry.metrics().increment(
    "button_login_click", // key
    1.0,                  // value
    null,                 // unit
    mapOf(                // tags
        "provider" to "e-mail"
    )
)

// Add '150' to a distribution
// used to track the loading time of an image.
Sentry.metrics().distribution(
  "image_download_duration",
  150.0,
  MeasurementUnit.Duration.MILLISECOND,
  mapOf(
      "type" to "thumbnail"
  )
)

// Add '15.0' to a gauge
// used for tracking the loading times for a page.
Sentry.metrics().gauge(
  "page_load",
  15.0,
  MeasurementUnit.Duration.MILLISECOND,
  mapOf(
      "page" to "/home"
  )
)

// Add 'jane' to a set
// used for tracking the number of users that viewed a page.
Sentry.metrics().set(
  "user_view",
  "jane",
  MeasurementUnit.Custom("username"),
  mapOf(
      "page" to "home"
  )
)`;

export const metricTagsExplanation = tct(
  'You can also enrich your metrics with [codeTags:tags] (key/value pairs like [codePlatform:platform:ios], [codeRegion:region:EU]) to provide added context. Filter and group metrics in the product by these tags to refine your analysis.',
  {
    codeTags: <code />,
    codePlatform: <code />,
    codeRegion: <code />,
  }
);

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
              value: 'kotlin',
              language: 'kotlin',
              code: getAndroidKotlinConfigureSnippet(params),
            },
            {
              label: 'Java',
              value: 'java',
              language: 'java',
              code: getAndroidJavaConfigureSnippet(params),
            },
            {
              label: 'XML',
              value: 'xml',
              language: 'xml',
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
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges]. These are available under the [codeNamespace:Sentry.metrics()] namespace.",
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
          description: metricTagsExplanation,
        },
        {
          description: t('Try out these examples:'),
          code: [
            {
              label: 'Kotlin',
              value: 'kotlin',
              language: 'kotlin',
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
        {
          description: t(
            'It can take up to 3 minutes for the data to appear in the Sentry UI.'
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
              language: 'kotlin',
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
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges]. These are available under the [codeNamespace:Sentry.metrics()] namespace.",
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
          description: metricTagsExplanation,
        },
        {
          description: t('Try out these examples:'),
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
              language: 'kotlin',
              code: getJvmKotlinVerifySnippet(),
            },
          ],
        },
        {
          description: t(
            'It can take up to 3 minutes for the data to appear in the Sentry UI.'
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
  dsn="${params.dsn.public}",
  # ...
)`;

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
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges].",
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
          description: metricTagsExplanation,
        },
        {
          description: t('Try out these examples:'),
          code: [
            {
              label: 'Counter',
              value: 'counter',
              language: 'python',
              code: exampleSnippets.python.counter,
            },
            {
              label: 'Distribution',
              value: 'distribution',
              language: 'python',
              code: exampleSnippets.python.distribution,
            },
            {
              label: 'Set',
              value: 'set',
              language: 'python',
              code: exampleSnippets.python.set,
            },
            {
              label: 'Gauge',
              value: 'gauge',
              language: 'python',
              code: exampleSnippets.python.gauge,
            },
          ],
        },
        {
          description: t(
            'It can take up to 3 minutes for the data to appear in the Sentry UI.'
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
  options.Dsn = "${params.dsn.public}";
  options.ExperimentalMetrics = new ExperimentalMetricsOptions
  {
    EnableCodeLocations = true
  };
});`;

export const getDotnetMetricsOnboarding = ({
  packageName,
}: {
  packageName: string;
}): OnboardingConfig => ({
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need a minimum version [codeVersion:4.0.0] of the .NET SDK installed.',
        {
          codeVersion: <code />,
        }
      ),
      configurations: [
        {
          language: 'powershell',
          code: `dotnet add package ${packageName}`,
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
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], [codeGauge:gauges], and [codeTimings:timings].",
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
          description: metricTagsExplanation,
        },
        {
          description: t('Try out these examples:'),
          code: [
            {
              label: 'Counter',
              value: 'counter',
              language: 'csharp',
              code: exampleSnippets.dotnet.counter,
            },
            {
              label: 'Distribution',
              value: 'distribution',
              language: 'csharp',
              code: exampleSnippets.dotnet.distribution,
            },
            {
              label: 'Set',
              value: 'set',
              language: 'csharp',
              code: exampleSnippets.dotnet.set,
            },
            {
              label: 'Gauge',
              value: 'gauge',
              language: 'csharp',
              code: exampleSnippets.dotnet.gauge,
            },
          ],
        },
        {
          description: t(
            'It can take up to 3 minutes for the data to appear in the Sentry UI.'
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
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges].",
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
          description: metricTagsExplanation,
        },
        {
          description: t('Try out these examples:'),
          code: [
            {
              label: 'Counter',
              value: 'counter',
              language: 'ruby',
              code: exampleSnippets.ruby.counter,
            },
            {
              label: 'Distribution',
              value: 'distribution',
              language: 'ruby',
              code: exampleSnippets.ruby.distribution,
            },
            {
              label: 'Set',
              value: 'set',
              language: 'ruby',
              code: exampleSnippets.ruby.set,
            },
            {
              label: 'Gauge',
              value: 'gauge',
              language: 'ruby',
              code: exampleSnippets.ruby.gauge,
            },
          ],
        },
        {
          description: t(
            'It can take up to 3 minutes for the data to appear in the Sentry UI.'
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
