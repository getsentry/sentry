import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayMobileConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {appleFeedbackOnboarding} from 'sentry/gettingStartedDocs/apple/macos';
import {t, tct} from 'sentry/locale';
import {appleProfilingOnboarding} from 'sentry/utils/gettingStartedDocs/apple';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';
import {getWizardInstallSnippet} from 'sentry/utils/gettingStartedDocs/mobileWizard';

type Params = DocsParams;

const getReplaySetupSnippet = (params: Params) => `
SentrySDK.start(configureOptions: { options in
  options.dsn = "${params.dsn.public}"
  options.debug = true

  options.sessionReplay.onErrorSampleRate = 1.0
  options.sessionReplay.sessionSampleRate = 0.1
})`;

const getReplayConfigurationSnippet = () => `
options.sessionReplay.maskAllText = true
options.sessionReplay.maskAllImages = true`;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      title: t('Automatic Configuration (Recommended)'),
      content: [
        {
          type: 'text',
          text: tct(
            'Add Sentry automatically to your app with the [wizardLink:Sentry wizard] (call this inside your project directory).',
            {
              wizardLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/#install" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: getWizardInstallSnippet({
            platform: 'ios',
            params,
          }),
        },
        {
          type: 'text',
          text: t('The Sentry wizard will automatically patch your application:'),
        },
        {
          type: 'list',
          items: [
            t('Install the Sentry SDK via Swift Package Manager or Cocoapods'),
            tct(
              'Update your [appDelegate: AppDelegate] or SwiftUI App Initializer with the default Sentry configuration and an example error',
              {
                appDelegate: <code />,
              }
            ),
            tct(
              'Add a new [code: Upload Debug Symbols] phase to your [code: xcodebuild] build script',
              {
                code: <code />,
              }
            ),
            tct(
              'Create [code: .sentryclirc] with an auth token to upload debug symbols (this file is automatically added to [code: .gitignore])',
              {
                code: <code />,
              }
            ),
            t(
              "When you're using Fastlane, it will add a Sentry lane for uploading debug symbols"
            ),
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      title: t('Manual Configuration'),
      collapsible: true,
      content: [
        {
          type: 'text',
          text: tct(
            'Alternatively, you can also set up the SDK manually, by following the [manualSetupLink:manual setup docs].',
            {
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/manual-setup/" />
              ),
            }
          ),
        },
        {
          type: 'custom',
          content: <CopyDsnField params={params} />,
        },
      ],
    },
  ],
  verify: () => [],
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

const replayOnboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            'Make sure your Sentry Cocoa SDK version is at least 8.43.0. If you already have the SDK installed, you can update it to the latest version with:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'SPM',
              language: 'swift',
              code: `.package(url: "https://github.com/getsentry/sentry-cocoa", from: "${getPackageVersion(
                params,
                'sentry.cocoa',
                '8.36.0'
              )}"),`,
            },
            {
              label: 'CocoaPods',
              language: 'ruby',
              code: `pod update`,
            },
            {
              label: 'Carthage',
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
          type: 'text',
          text: t(
            'To set up the integration, add the following to your Sentry initialization:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Swift',
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
      content: [
        {
          type: 'text',
          text: getReplayMobileConfigureDescription({
            link: 'https://docs.sentry.io/platforms/apple/guides/ios/session-replay/#privacy',
          }),
        },
        {
          type: 'text',
          text: t(
            'The following code is the default configuration, which masks and blocks everything.'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Swift',
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

const logsOnboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Logs for Apple platforms are supported in Sentry Cocoa SDK version [code:8.55.0] and above. If you are using an older major version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/migration/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'SPM',
              language: 'swift',
              code: `.package(url: "https://github.com/getsentry/sentry-cocoa", from: "${getPackageVersion(
                params,
                'sentry.cocoa',
                '8.55.0'
              )}"),`,
            },
            {
              label: 'CocoaPods',
              language: 'ruby',
              code: `pod update`,
            },
            {
              label: 'Carthage',
              language: 'swift',
              code: `github "getsentry/sentry-cocoa" "${getPackageVersion(
                params,
                'sentry.cocoa',
                '8.55.0'
              )}"`,
            },
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable logging, you need to initialize the SDK with the [code:enableLogs] option set to true.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Swift',
              language: 'swift',
              code: `import Sentry

SentrySDK.start { options in
    options.dsn = "${params.dsn.public}"
    // Enable logs to be sent to Sentry
    options.experimental.enableLogs = true
}`,
            },
            {
              label: 'Objective-C',
              language: 'objc',
              code: `@import Sentry;

[SentrySDK startWithConfigureOptions:^(SentryOptions *options) {
    options.dsn = @"${params.dsn.public}";
    // Enable logs to be sent to Sentry
    options.experimental.enableLogs = YES;
}];`,
            },
          ],
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t('Send a test log from your app to verify logs are arriving in Sentry.'),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Swift',
              language: 'swift',
              code: `import Sentry

let logger = SentrySDK.logger

logger.info("Sending a test info log")

logger.warn("Sending a test warning log", attributes: [
    "log_type": "test",
])`,
            },
            {
              label: 'Objective-C',
              language: 'objc',
              code: `@import Sentry;

SentryLogger *logger = SentrySDK.logger;

[logger info:@"Sending a test info log"];
[logger warn:@"Sending a test warning log" attributes:@{@"log_type": @"test"}];`,
            },
          ],
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: appleFeedbackOnboarding,
  crashReportOnboarding: appleFeedbackOnboarding,
  replayOnboarding,
  profilingOnboarding: appleProfilingOnboarding,
  logsOnboarding,
};

export default docs;
