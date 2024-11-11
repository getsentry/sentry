import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getInstallSnippet = (params: Params) => `
.package(url: "https://github.com/getsentry/sentry-cocoa", from: "${getPackageVersion(
  params,
  'sentry.cocoa',
  '8.9.3'
)}"),`;

const getConfigurationSnippet = (params: Params) => `
import Sentry

// ....

func applicationDidFinishLaunching(_ aNotification: Notification) {

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

        // Manually call start_profiler and stop_profiler
        // to profile the code in between
        SentrySDK.startProfiler()
        // do some work here
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

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: (
        <p>
          {tct(
            'We recommend installing the SDK with Swift Package Manager (SPM), but we also support [alternateMethods: alternate installation methods]. To integrate Sentry into your Xcode project using SPM, open your App in Xcode and open [addPackage: File > Add Packages]. Then add the SDK by entering the Git repo url in the top right search field:',
            {
              alternateMethods: (
                <ExternalLink href="https://docs.sentry.io/platforms/apple/install/" />
              ),
              addPackage: <strong />,
            }
          )}
        </p>
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
          code: getInstallSnippet(params),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: (
        <p>
          {tct(
            'Make sure you initialize the SDK as soon as possible in your application lifecycle e.g. in your [appDelegate:] method:',
            {
              appDelegate: (
                <code>
                  - [NSAppDelegate applicationDidFinishLaunchingWithNotification:]
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
  verify: () => [
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

export const appleFeedbackOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: getCrashReportInstallDescription(),
      configurations: [
        {
          code: [
            {
              label: 'Swift',
              value: 'swift',
              language: 'swift',
              code: `import Sentry

let eventId = SentrySDK.capture(message: "My message.")

let userFeedback = UserFeedback(eventId: eventId)
userFeedback.comments = "It broke."
userFeedback.email = "john.doe@example.com"
userFeedback.name = "John Doe"
SentrySDK.capture(userFeedback: userFeedback)`,
            },
            {
              label: 'Objective-C',
              value: 'c',
              language: 'c',
              code: `@import Sentry;

SentryId *eventId = [SentrySDK captureMessage:@"My message"];

SentryUserFeedback *userFeedback = [[SentryUserFeedback alloc] initWithEventId:eventId];
userFeedback.comments = @"It broke.";
userFeedback.email = @"john.doe@example.com";
userFeedback.name = @"John Doe";
[SentrySDK captureUserFeedback:userFeedback];`,
            },
          ],
        },
        {
          description: tct(
            'To capture user feedback regarding a crash, use the [code:SentryOptions.onCrashedLastRun] callback. This callback gets called shortly after the initialization of the SDK when the last program execution terminated with a crash. It is not guaranteed that this is called on the main thread.',
            {code: <code />}
          ),
          code: [
            {
              label: 'Swift',
              value: 'swift',
              language: 'swift',
              code: `import Sentry

SentrySDK.start { options in
    options.dsn = "${params.dsn.public}"
    options.onCrashedLastRun = { event in
        // capture user feedback
    }
}
`,
            },
            {
              label: 'Objective-C',
              value: 'c',
              language: 'c',
              code: `@import Sentry;

[SentrySDK startWithConfigureOptions:^(SentryOptions *options) {
    options.dsn = @"${params.dsn.public}";
    options.onCrashedLastRun = ^void(SentryEvent * _Nonnull event) {
        // capture user feedback
    };
}];`,
            },
          ],
        },
      ],
    },
  ],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: appleFeedbackOnboarding,
  crashReportOnboarding: appleFeedbackOnboarding,
};

export default docs;
