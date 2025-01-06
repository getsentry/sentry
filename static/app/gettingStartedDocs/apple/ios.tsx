import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  BasePlatformOptions,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {MobileBetaBanner} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {metricTagsExplanation} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {
  getReplayMobileConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {appleFeedbackOnboarding} from 'sentry/gettingStartedDocs/apple/macos';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export enum InstallationMode {
  AUTO = 'auto',
  MANUAL = 'manual',
}

const platformOptions = {
  installationMode: {
    label: t('Installation Mode'),
    items: [
      {
        label: t('Auto'),
        value: InstallationMode.AUTO,
      },
      {
        label: t('Manual'),
        value: InstallationMode.MANUAL,
      },
    ],
    defaultValue:
      navigator.userAgent.indexOf('Win') !== -1
        ? InstallationMode.MANUAL
        : InstallationMode.AUTO,
  },
} satisfies BasePlatformOptions;

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const isAutoInstall = (params: Params) =>
  params.platformOptions.installationMode === InstallationMode.AUTO;

const getAutoInstallSnippet = () =>
  `brew install getsentry/tools/sentry-wizard && sentry-wizard -i ios`;

const getManualInstallSnippet = (params: Params) => `
.package(url: "https://github.com/getsentry/sentry-cocoa", from: "${getPackageVersion(
  params,
  'sentry.cocoa',
  '8.9.3'
)}"),`;

const getConfigurationSnippet = (params: Params) => `
import Sentry

// ....

func application(_ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    SentrySDK.start { options in
        options.dsn = "${params.dsn.public}"
        options.debug = true // Enabling debug when first installing is always helpful${
          params.isPerformanceSelected
            ? `

        // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
        // We recommend adjusting this value in production.
        options.tracesSampleRate = 1.0`
            : ''
        }${
          params.isProfilingSelected &&
          params.profilingOptions?.defaultProfilingMode !== 'continuous'
            ? `

        // Sample rate for profiling, applied on top of TracesSampleRate.
        // We recommend adjusting this value in production.
        options.profilesSampleRate = 1.0`
            : ''
        }
    }${
      params.isProfilingSelected &&
      params.profilingOptions?.defaultProfilingMode === 'continuous'
        ? `

    // Manually call startProfiler and stopProfiler
    // to profile the code in between
    SentrySDK.startProfiler()
    // this code will be profiled
    //
    // Calls to stopProfiler are optional - if you don't stop the profiler, it will keep profiling
    // your application until the process exits or stopProfiler is called.
    SentrySDK.stopProfiler()`
        : ''
    }

    return true
}`;

const getConfigurationSnippetSwiftUi = (params: Params) => `
import Sentry

@main
struct SwiftUIApp: App {
    init() {
        SentrySDK.start { options in
            options.dsn = "${params.dsn.public}"
            options.debug = true // Enabling debug when first installing is always helpful${
              params.isPerformanceSelected
                ? `

            // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
            // We recommend adjusting this value in production.
            options.tracesSampleRate = 1.0`
                : ''
            }${
              params.isProfilingSelected &&
              params.profilingOptions?.defaultProfilingMode !== 'continuous'
                ? `

            // Sample rate for profiling, applied on top of TracesSampleRate.
            // We recommend adjusting this value in production.
            options.profilesSampleRate = 1.0`
                : ''
            }
        }${
          params.isProfilingSelected &&
          params.profilingOptions?.defaultProfilingMode === 'continuous'
            ? `

        // Manually call startProfiler and stopProfiler
        // to profile the code in between
        SentrySDK.startProfiler()
        // this code will be profiled
        //
        // Calls to stopProfiler are optional - if you don't stop the profiler, it will keep profiling
        // your application until the process exits or stopProfiler is called.
        SentrySDK.stopProfiler()`
            : ''
        }
    }
}`;

const getVerifySnippet = () => `
let button = UIButton(type: .roundedRect)
button.frame = CGRect(x: 20, y: 50, width: 100, height: 30)
button.setTitle("Break the world", for: [])
button.addTarget(self, action: #selector(self.breakTheWorld(_:)), for: .touchUpInside)
view.addSubview(button)

@IBAction func breakTheWorld(_ sender: AnyObject) {
    fatalError("Break the world")
}`;

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
    options.dsn = "${params.dsn.public}"

    options.enableMetrics = true
}`;

const getConfigureMetricsSnippetObjC = (params: Params) => `
@import Sentry;

[SentrySDK startWithConfigureOptions:^(SentryOptions * options) {
    options.Dsn = @"${params.dsn.public}";

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

const getReplaySetupSnippet = (params: Params) => `
SentrySDK.start(configureOptions: { options in
  options.dsn = "${params.dsn.public}"
  options.debug = true

  options.sessionReplay.onErrorSampleRate = 1.0
  options.sessionReplay.sessionSampleRate = 0.1
})`;

const getReplayConfigurationSnippet = () => `
options.sessionReplay.redactAllText = true
options.sessionReplay.redactAllImages = true`;

const onboarding: OnboardingConfig<PlatformOptions> = {
  install: params =>
    isAutoInstall(params)
      ? [
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
                code: getAutoInstallSnippet(),
              },
            ],
          },
        ]
      : [
          {
            type: StepType.INSTALL,
            description: tct(
              'We recommend installing the SDK with Swift Package Manager (SPM), but we also support [alternateMethods: alternate installation methods]. To integrate Sentry into your Xcode project using SPM, open your App in Xcode and open [addPackage: File > Add Packages]. Then add the SDK by entering the Git repo url in the top right search field:',
              {
                alternateMethods: (
                  <ExternalLink href="https://docs.sentry.io/platforms/apple/install/" />
                ),
                addPackage: <strong />,
              }
            ),
            configurations: [
              {
                language: 'url',
                code: `https://github.com/getsentry/sentry-cocoa.git`,
              },
              {
                description: (
                  <p>
                    {tct(
                      'Alternatively, when your project uses a [packageSwift: Package.swift] file to manage dependencies, you can specify the target with:',
                      {
                        packageSwift: <code />,
                      }
                    )}
                  </p>
                ),
                language: 'swift',
                partialLoading: params.sourcePackageRegistries.isLoading,
                code: getManualInstallSnippet(params),
              },
            ],
          },
        ],
  configure: params =>
    isAutoInstall(params)
      ? [
          {
            type: StepType.CONFIGURE,
            description: t(
              'The Sentry wizard will automatically patch your application:'
            ),
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
                        'Add a new [code: Upload Debug Symbols] phase to your [code: xcodebuild] build script',
                        {
                          code: <code />,
                        }
                      )}
                    </ListItem>
                    <ListItem>
                      {tct(
                        'Create [code: .sentryclirc] with an auth token to upload debug symbols (this file is automatically added to [code: .gitignore])',
                        {
                          code: <code />,
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
        ]
      : [
          {
            type: StepType.CONFIGURE,
            description: (
              <p>
                {tct(
                  'Make sure you initialize the SDK as soon as possible in your application lifecycle e.g. in your [appDelegate:] method:',
                  {
                    appDelegate: (
                      <code>
                        - [UIAppDelegate application:didFinishLaunchingWithOptions:]
                      </code>
                    ),
                  }
                )}
              </p>
            ),
            configurations: [
              {
                language: 'swift',
                code: getConfigurationSnippet(params),
              },
              {
                description: (
                  <p>
                    {tct(
                      "When using SwiftUI and your app doesn't implement an app delegate, initialize the SDK within the [initializer: App conformer's initializer]:",
                      {
                        initializer: (
                          <ExternalLink href="https://developer.apple.com/documentation/swiftui/app/main()" />
                        ),
                      }
                    )}
                  </p>
                ),
                language: 'swift',
                code: getConfigurationSnippetSwiftUi(params),
              },
            ],
          },
        ],
  verify: params =>
    isAutoInstall(params)
      ? [
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
                  <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/tracing/instrumentation/automatic-instrumentation/#time-to-full-display" />
                ),
                metricKit: (
                  <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/watchos/configuration/metric-kit/" />
                ),
                prewarmedAppStart: (
                  <ExternalLink href="https://docs.sentry.io/platforms/apple/tracing/instrumentation/automatic-instrumentation/#prewarmed-app-start-tracing" />
                ),
                asyncStacktraces: (
                  <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/#stitch-together-swift-concurrency-stack-traces" />
                ),
                gh: (
                  <ExternalLink href="https://github.com/getsentry/sentry-cocoa/issues" />
                ),
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
        ]
      : [
          {
            type: StepType.VERIFY,
            description: (
              <p>
                {tct(
                  'This snippet contains an intentional error you can use to test that errors are uploaded to Sentry correctly. You can add it to your main [viewController: ViewController].',
                  {
                    viewController: <code />,
                  }
                )}
              </p>
            ),
            configurations: [
              {
                language: 'swift',
                code: getVerifySnippet(),
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
      link: 'https://docs.sentry.io/platforms/apple/tracing/instrumentation/swiftui-instrumentation/',
    },
  ],
};

const metricsOnboarding: OnboardingConfig<PlatformOptions> = {
  install: (params: Params) => [
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
          code: getAutoInstallSnippet(),
        },
      ],
    },
  ],
  configure: (params: Params) => [
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
        "Then you'll be able to add metrics as [code:counters], [code:sets], [code:distributions], and [code:gauges]. These are available under the [code:SentrySDK.metrics()] namespace.",
        {
          code: <code />,
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
            'It can take up to 3 minutes for the data to appear in the Sentry UI.'
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

const replayOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () => (
    <MobileBetaBanner link="https://docs.sentry.io/platforms/android/session-replay/" />
  ),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: t(
        'Make sure your Sentry Cocoa SDK version is at least 8.43.0. If you already have the SDK installed, you can update it to the latest version with:'
      ),
      configurations: [
        {
          code: [
            {
              label: 'SPM',
              value: 'spm',
              language: 'swift',
              code: `.package(url: "https://github.com/getsentry/sentry-cocoa", from: "${getPackageVersion(
                params,
                'sentry.cocoa',
                '8.36.0'
              )}"),`,
            },
            {
              label: 'CocoaPods',
              value: 'cocoapods',
              language: 'ruby',
              code: `pod update`,
            },
            {
              label: 'Carthage',
              value: 'carthage',
              language: 'swift',
              code: `github "getsentry/sentry-cocoa" "${getPackageVersion(
                params,
                'sentry.cocoa',
                '8.36.0'
              )}"`,
            },
          ],
        },
        {
          description: t(
            'To set up the integration, add the following to your Sentry initialization:'
          ),
        },
        {
          code: [
            {
              label: 'Swift',
              value: 'swift',
              language: 'swift',
              code: getReplaySetupSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getReplayMobileConfigureDescription({
        link: 'https://docs.sentry.io/platforms/apple/guides/ios/session-replay/#privacy',
      }),
      configurations: [
        {
          description: t(
            'The following code is the default configuration, which masks and blocks everything.'
          ),
          code: [
            {
              label: 'Swift',
              value: 'swift',
              language: 'swift',
              code: getReplayConfigurationSnippet(),
            },
          ],
        },
      ],
    },
  ],
  verify: getReplayVerifyStep({
    replayOnErrorSampleRateName: 'options\u200b.sessionReplay\u200b.onErrorSampleRate',
    replaySessionSampleRateName: 'options\u200b.sessionReplay\u200b.sessionSampleRate',
  }),
  nextSteps: () => [],
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  feedbackOnboardingCrashApi: appleFeedbackOnboarding,
  crashReportOnboarding: appleFeedbackOnboarding,
  customMetricsOnboarding: metricsOnboarding,
  platformOptions,
  replayOnboarding,
};

export default docs;
