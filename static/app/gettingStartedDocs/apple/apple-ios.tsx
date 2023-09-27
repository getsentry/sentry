import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = (): LayoutProps['steps'] => [
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
        code: `brew install getsentry/tools/sentry-wizard && sentry-wizard -i ios`,
      },
    ],
  },
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
        additionalInfo: (
          <p>
            {tct(
              'Alternatively, you can also [manualSetupLink:set up the SDK manually].',
              {
                manualSetupLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/manual-setup/" />
                ),
                stepsBelow: <strong />,
              }
            )}
          </p>
        ),
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'The Sentry wizard automatically adds a code snippet that generates an error to your project. Simply run your app and you should see the error in your Sentry project.'
    ),
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

export function GettingStartedWithIos(props: ModuleProps) {
  return <Layout steps={steps()} nextSteps={nextSteps} {...props} />;
}

export default GettingStartedWithIos;
