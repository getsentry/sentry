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
        options.dsn = "${params.dsn}"
        options.debug = true // Enabled debug when first installing is always helpful

        // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
        // We recommend adjusting this value in production.
        options.tracesSampleRate = 1.0
    }

    return true
}`;

const getConfigurationSnippetSwiftUi = (params: Params) => `
import Sentry

@main
struct SwiftUIApp: App {
    init() {
        SentrySDK.start { options in
            options.dsn = "${params.dsn}"
            options.debug = true // Enabled debug when first installing is always helpful

            // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
            // We recommend adjusting this value in production.
            options.tracesSampleRate = 1.0
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
            'Make sure you initialize the SDK as soon as possible in your application lifecycle e.g. in your AppDelegate [appDelegate: application:didFinishLaunchingWithOptions] method:',
            {
              appDelegate: <code />,
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

const docs: Docs = {
  onboarding,
};

export default docs;
