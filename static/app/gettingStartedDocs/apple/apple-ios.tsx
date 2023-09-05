import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

interface StepProps {
  dsn: string;
  hasPerformance: boolean;
  hasProfiling: boolean;
  sourcePackageRegistries?: ModuleProps['sourcePackageRegistries'];
}

// Configuration Start
export const steps = ({
  dsn,
  sourcePackageRegistries,
  hasPerformance,
  hasProfiling,
}: StepProps): LayoutProps['steps'] => [
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
        language: 'text',
        code: `
https://github.com/getsentry/sentry-cocoa.git
        `,
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
        partialLoading: sourcePackageRegistries?.isLoading,
        code: `
.package(url: "https://github.com/getsentry/sentry-cocoa", from: "${
          sourcePackageRegistries?.isLoading
            ? t('\u2026loading')
            : sourcePackageRegistries?.data?.['sentry.cocoa']?.version ?? '8.9.3'
        }"),
        `,
      },
    ],
  },
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
        code: `
import Sentry

// ....

func application(_ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    SentrySDK.start { options in
        options.dsn = "${dsn}"
        options.debug = true // Enabled debug when first installing is always helpful${
          hasPerformance
            ? `

        // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
        // We recommend adjusting this value in production.
        options.tracesSampleRate = 1.0`
            : ''
        }${
          hasProfiling
            ? `
        // Set profilesSampleRate to 1.0 to profile 100% of sampled transactions.
        // We recommend adjusting this value in production
        options.profilesSampleRate = 1.0`
            : ''
        }
    }

    return true
}
        `,
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
        code: `
import Sentry

@main
struct SwiftUIApp: App {
    init() {
        SentrySDK.start { options in
            options.dsn = "${dsn}"
            options.debug = true // Enabled debug when first installing is always helpful${
              hasPerformance
                ? `

            // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
            // We recommend adjusting this value in production.
            options.tracesSampleRate = 1.0`
                : ''
            }${
          hasProfiling
            ? `
            // Set profilesSampleRate to 1.0 to profile 100% of sampled transactions.
            // We recommend adjusting this value in production
            options.profilesSampleRate = 1.0`
            : ''
        }
        }
    }
}
        `,
      },
    ],
  },
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
        code: `
let button = UIButton(type: .roundedRect)
button.frame = CGRect(x: 20, y: 50, width: 100, height: 30)
button.setTitle("Break the world", for: [])
button.addTarget(self, action: #selector(self.breakTheWorld(_:)), for: .touchUpInside)
view.addSubview(button)

@IBAction func breakTheWorld(_ sender: AnyObject) {
    fatalError("Break the world")
}
        `,
      },
    ],
  },
  {
    title: t('Experimental Features'),
    description: (
      <p>
        {tct(
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
        )}
      </p>
    ),
    configurations: [
      {
        language: 'swift',
        code: `
import Sentry

SentrySDK.start { options in
    // ...

    // Enable all experimental features
    options.attachViewHierarchy = true
    options.enablePreWarmedAppStartTracing = true
    options.enableMetricKit = true
    options.enableTimeToFullDisplayTracing = true
    options.swiftAsyncStacktraces = true
}
        `,
      },
    ],
  },
];

export const nextSteps = [
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
];
// Configuration End

export function GettingStartedWithIos({
  dsn,
  sourcePackageRegistries,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const hasPerformance = activeProductSelection.includes(
    ProductSolution.PERFORMANCE_MONITORING
  );
  const hasProfiling = activeProductSelection.includes(ProductSolution.PROFILING);
  return (
    <Layout
      steps={steps({dsn, sourcePackageRegistries, hasPerformance, hasProfiling})}
      nextSteps={nextSteps}
      {...props}
    />
  );
}

export default GettingStartedWithIos;
