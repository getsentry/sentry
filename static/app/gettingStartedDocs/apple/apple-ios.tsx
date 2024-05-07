import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {metricTagsExplanation} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {appleFeedbackOnboarding} from 'sentry/gettingStartedDocs/apple/apple-macos';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () =>
  `brew install getsentry/tools/sentry-wizard && sentry-wizard -i ios`;

const getExperimentalFeaturesSnippetSwift = () => `
import Sentry

SentrySDK.start { options in
    // ...

    // Enable all experimental features
    options.attachViewHierarchy = true
    options.enableMetricKit = true
    options.enableTimeToFullDisplayTracing = true
    options.swiftAsyncStacktraces = true
    options.enableAppLaunchProfiling = true
}`;

const getExperimentalFeaturesSnippetObjC = () => `
@import Sentry;

[SentrySDK startWithConfigureOptions:^(SentryOptions *options) {
    // ...

    // Enable all experimental features
    options.attachViewHierarchy = YES;
    options.enableMetricKit = YES;
    options.enableTimeToFullDisplayTracing = YES;
    options.swiftAsyncStacktraces = YES;
    options.enableAppLaunchProfiling = YES;
}];`;

const getConfigureMetricsSnippetSwift = (params: Params) => `
import Sentry

SentrySDK.start { options in
    options.dsn = "${params.dsn}"

    options.enableMetrics = true
}`;

const getConfigureMetricsSnippetObjC = (params: Params) => `
@import Sentry;

[SentrySDK startWithConfigureOptions:^(SentryOptions * options) {
    options.Dsn = @"${params.dsn}";

    options.enableMetrics = YES;
}];`;

const getVerifyMetricsSnippetSwift = () => `
import Sentry

// Incrementing a counter by one for each button click.
SentrySDK.metrics
    .increment(key: "button_login_click",
               value: 1.0,
               tags: ["screen": "login"]
    )

// Add '150' to a distribution used to track the loading time.
SentrySDK.metrics
    .distribution(key: "image_download_duration",
                value: 150.0,
                unit: MeasurementUnitDuration.millisecond,
                tags: ["screen": "login"]
    )

// Adding '1' to a gauge used to track the loading time.
SentrySDK.metrics
    .gauge(key: "page_load",
          value: 1.0,
          unit: MeasurementUnitDuration.millisecond,
          tags: ["screen": "login"]
    )

// Add 'jane' to a set
// used for tracking the number of users that viewed a page.
SentrySDK.metrics
    .set(key: "user_view",
          value: "jane",
          unit: MeasurementUnit(unit: "username"),
          tags: ["screen": "login"]
    )`;

const getVerifyMetricsSnippetObjC = () => `
@import Sentry;

// Incrementing a counter by one for each button click.
[SentrySDK.metrics
    incrementWithKey :@"button_login_click"
    value: 1.0
    unit: SentryMeasurementUnit.none
    tags: @{ @"screen" : @"login" }
];

// Add '150' to a distribution used to track the loading time.
[SentrySDK.metrics
    distributionWithKey: @"image_download_duration"
    value: 150.0
    unit: SentryMeasurementUnitDuration.millisecond
    tags: @{ @"screen" : @"login" }
];

// Adding '1' to a gauge used to track the loading time.
[SentrySDK.metrics
    gaugeWithKey: @"page_load"
    value: 1.0
    unit: SentryMeasurementUnitDuration.millisecond
    tags: @{ @"screen" : @"login" }
];

// Add 'jane' to a set
// used for tracking the number of users that viewed a page.
[SentrySDK.metrics
  setWithKey :@"user_view"
  value: @"jane"
  unit: [[SentryMeasurementUnit alloc] initWithUnit:@"username"]
  tags: @{ @"screen" : @"login" }
];`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: (
        <p>
          {tct(
            'Add Sentry automatically to your app with the [wizardLink:Sentry wizard] (call this inside your project directory).',
            {
              wizardLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/#install" />
              ),
            }
          )}
        </p>
      ),
      configurations: [
        {
          language: 'bash',
          code: getInstallSnippet(),
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: t('The Sentry wizard will automatically patch your application:'),
      configurations: [
        {
          description: (
            <List symbol="bullet">
              <ListItem>
                {t('Install the Sentry SDK via Swift Package Manager or Cocoapods')}
              </ListItem>
              <ListItem>
                {tct(
                  'Update your [appDelegate: AppDelegate] or SwiftUI App Initializer with the default Sentry configuration and an example error',
                  {
                    appDelegate: <code />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  'Add a new [phase: Upload Debug Symbols] phase to your [xcodebuild: xcodebuild] build script',
                  {
                    phase: <code />,
                    xcodebuild: <code />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  'Create [sentryclirc: .sentryclirc] with an auth token to upload debug symbols (this file is automatically added to [gitignore: .gitignore])',
                  {
                    sentryclirc: <code />,
                    gitignore: <code />,
                  }
                )}
              </ListItem>
              <ListItem>
                {t(
                  "When you're using Fastlane, it will add a Sentry lane for uploading debug symbols"
                )}
              </ListItem>
            </List>
          ),
          additionalInfo: tct(
            'Alternatively, you can also [manualSetupLink:set up the SDK manually].',
            {
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/manual-setup/" />
              ),
              stepsBelow: <strong />,
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'The Sentry wizard automatically adds a code snippet that captures a message to your project. Simply run your app and you should see this message in your Sentry project.'
      ),
    },
    {
      title: t('Experimental Features'),
      description: tct(
        'Want to play with some new features? Try out our experimental features for [vh: View Hierarchy], [ttfd: Time to Full Display (TTFD)], [metricKit: MetricKit], [prewarmedAppStart: Prewarmed App Start Tracing], and [asyncStacktraces: Swift Async Stacktraces]. Experimental features are still a work-in-progress and may have bugs. We recognize the irony. [break] Let us know if you have feedback through [gh: GitHub issues].',
        {
          vh: (
            <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/enriching-events/viewhierarchy/" />
          ),
          ttfd: (
            <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/performance/instrumentation/automatic-instrumentation/#time-to-full-display" />
          ),
          metricKit: (
            <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/watchos/configuration/metric-kit/" />
          ),
          prewarmedAppStart: (
            <ExternalLink href="https://docs.sentry.io/platforms/apple/performance/instrumentation/automatic-instrumentation/#prewarmed-app-start-tracing" />
          ),
          asyncStacktraces: (
            <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/#stitch-together-swift-concurrency-stack-traces" />
          ),
          gh: <ExternalLink href="https://github.com/getsentry/sentry-cocoa/issues" />,
          break: <br />,
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'Swift',
              value: 'swift',
              language: 'swift',
              code: getExperimentalFeaturesSnippetSwift(),
            },
            {
              label: 'Objective-C',
              value: 'c',
              language: 'c',
              code: getExperimentalFeaturesSnippetObjC(),
            },
          ],
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      id: 'cocoapods-carthage',
      name: t('CocoaPods/Carthage'),
      description: t(
        'Learn about integrating Sentry into your project using CocoaPods or Carthage.'
      ),
      link: 'https://docs.sentry.io/platforms/apple/install/',
    },
    {
      id: 'debug-symbols',
      name: t('Debug Symbols'),
      description: t('Symbolicate and get readable stacktraces in your Sentry errors.'),
      link: 'https://docs.sentry.io/platforms/apple/dsym/',
    },
    {
      id: 'swiftui',
      name: t('SwiftUI'),
      description: t('Learn about our first class integration with SwiftUI.'),
      link: 'https://docs.sentry.io/platforms/apple/performance/instrumentation/swiftui-instrumentation/',
    },
    {
      id: 'profiling',
      name: t('Profiling'),
      description: t(
        'Collect and analyze performance profiles from real user devices in production.'
      ),
      link: 'https://docs.sentry.io/platforms/apple/profiling/',
    },
  ],
};

const metricsOnboarding: OnboardingConfig = {
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need Sentry Cocoa SDK version [codeVersion:8.23.0] or higher. Learn more about installation methods in our [docsLink:full documentation].',
        {
          codeVersion: <code />,
          docsLink: <Link to={`/projects/${params.projectSlug}/getting-started/`} />,
        }
      ),
      configurations: [
        {
          language: 'yml',
          partialLoading: params.sourcePackageRegistries?.isLoading,
          code: getInstallSnippet(),
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'To enable capturing metrics, you need to enable the metrics feature.'
      ),
      configurations: [
        {
          code: [
            {
              label: 'Swift',
              value: 'swift',
              language: 'swift',
              code: getConfigureMetricsSnippetSwift(params),
            },
            {
              label: 'Objective-C',
              value: 'c',
              language: 'c',
              code: getConfigureMetricsSnippetObjC(params),
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
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges]. These are available under the [codeNamespace:SentrySDK.metrics()] namespace.",
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
              label: 'Swift',
              value: 'swift',
              language: 'swift',
              code: getVerifyMetricsSnippetSwift(),
            },
            {
              label: 'Objective-C',
              value: 'c',
              language: 'c',
              code: getVerifyMetricsSnippetObjC(),
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
                <ExternalLink href="https://docs.sentry.io/platforms/apple/metrics/" />
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
  feedbackOnboardingCrashApi: appleFeedbackOnboarding,
  crashReportOnboarding: appleFeedbackOnboarding,
  customMetricsOnboarding: metricsOnboarding,
};

export default docs;
