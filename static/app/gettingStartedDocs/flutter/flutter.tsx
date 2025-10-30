import {ExternalLink} from 'sentry/components/core/link';
import {CopyDsnField} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import type {
  BasePlatformOptions,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayMobileConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {crashReport} from 'sentry/gettingStartedDocs/dart/dart/crashReport';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';
import {getWizardInstallSnippet} from 'sentry/utils/gettingStartedDocs/mobileWizard';

const getManualInstallSnippet = (params: DocsParams) => {
  const version = getPackageVersion(params, 'sentry.dart.flutter', '9.6.0');
  return `dependencies:
  sentry_flutter: ^${version}`;
};

const getVerifySnippet = (params: DocsParams<BasePlatformOptions>) => {
  const logsCode = params.isLogsSelected
    ? `
    // Send a log before throwing the error
    Sentry.logger.info("User triggered test error button", {
      'action': SentryLogAttribute.string('test_error_button_click'),
    });`
    : '';
  return `
import 'package:sentry/sentry.dart';

child: ElevatedButton(
  onPressed: () {${logsCode}
    throw StateError('This is test exception');
  },
  child: const Text('Verify Sentry Setup'),
)
`;
};

const getFeedbackConfigureSnippet = () => `
// The example uses the NavigatorState to present the widget. Adapt as needed to your navigation stack.
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

...

await SentryFlutter.init((options) {
  options.beforeSend = (event, hint) async {
    // Filter here what kind of events you want users to give you feedback.

    final screenshot = await SentryFlutter.captureScreenshot();
    final context = navigatorKey.currentContext;
    if (context == null) return;
    if (context.mounted) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => SentryFeedbackWidget(
            associatedEventId: event.eventId,
            screenshot: screenshot,
          ),
          fullscreenDialog: true,
        ),
      );
    }
  };
});
`;

const getInstallReplaySnippet = () => `
await SentryFlutter.init(
  (options) {
    ...
    options.replay.sessionSampleRate = 1.0;
    options.replay.onErrorSampleRate = 1.0;
  },
  appRunner: () => runApp(
      SentryWidget(
        child: MyApp(),
      ),
    ),
);
`;

const getConfigureReplaySnippet = () => `
options.replay.maskAllText = true;
options.replay.maskAllImages = true;`;

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
                <ExternalLink href="https://docs.sentry.io/platforms/flutter/#install" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: getWizardInstallSnippet({
            platform: 'flutter',
            params,
          }),
        },
        {
          type: 'text',
          text: t(
            'The Sentry wizard will automatically patch your project with the following:'
          ),
        },
        {
          type: 'list',
          items: [
            tct(
              'Configure the SDK with your DSN and performance monitoring options in your [main:main.dart] file.',
              {
                main: <code />,
              }
            ),
            tct('Update your [pubspec:pubspec.yaml] with the Sentry package', {
              pubspec: <code />,
            }),
            t('Add an example error to verify your setup'),
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      collapsible: true,
      title: t('Manual Configuration'),
      content: [
        {
          type: 'text',
          text: tct(
            'Alternatively, you can also set up the SDK manually, by following the [manualSetupLink:manual setup docs].',
            {
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/flutter/manual-setup/" />
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
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Create an intentional error, so you can test that everything is working. In the example below, pressing the button will throw an exception:'
          ),
        },
        {
          type: 'code',
          language: 'dart',
          code: getVerifySnippet(params),
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      name: t('Upload Debug Symbols'),
      description: t(
        'We offer a range of methods to provide Sentry with debug symbols so that you can see symbolicated stack traces and find the cause of your errors faster.'
      ),
      link: 'https://docs.sentry.io/platforms/flutter/upload-debug/',
    },
    {
      name: t('Distributed Tracing'),
      description: t(
        'Connect all your services by configuring your endpoints in the Sentry init.'
      ),
      link: 'https://docs.sentry.io/platforms/flutter/tracing/trace-propagation/limiting-trace-propagation/',
    },
    {
      name: t('Connect your Git Repo'),
      description: t(
        'Adding our Git integrations will allow us determine suspect commits, comment on PRs, and create links directly to your source code from Sentry issues.'
      ),
      link: 'https://docs.sentry.io/organization/integrations/source-code-mgmt/',
    },
    {
      name: t('Structured Logs'),
      description: t(
        'Learn how to send structured logs to Sentry and view them alongside your errors.'
      ),
      link: 'https://docs.sentry.io/platforms/dart/guides/flutter/logs/',
    },
  ],
};

const replayOnboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Make sure your Sentry Flutter SDK version is at least 8.9.0, which is required for Session Replay. You can update your [code:pubspec.yaml] to the matching version:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'YAML',
              language: 'yaml',
              code: getManualInstallSnippet(params),
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
              label: 'Dart',
              language: 'dart',
              code: getInstallReplaySnippet(),
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
            link: 'https://docs.sentry.io/platforms/flutter/session-replay/#privacy',
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
              label: 'Dart',
              language: 'dart',
              code: getConfigureReplaySnippet(),
            },
          ],
        },
      ],
    },
  ],
  verify: getReplayVerifyStep({
    replayOnErrorSampleRateName: 'options\u200b.replay\u200b.onErrorSampleRate',
    replaySessionSampleRateName: 'options\u200b.replay\u200b.sessionSampleRate',
  }),
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Use the [code:SentryFeedbackWidget] to let users send feedback data to Sentry.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            "The widget requests and collects the user's name, email address, and a description of what occurred. When an event identifier is provided, Sentry pairs the feedback with the original event, giving you additional insights into issues. Additionally, you can provide a screenshot that will be sent to Sentry. Learn more about how to enable screenshots in our [screenshotsDocs:screenshots documentation].",
            {
              screenshotsDocs: (
                <ExternalLink href="https://docs.sentry.io/platforms/dart/guides/flutter/enriching-events/screenshots/" />
              ),
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            'One possible use for the [code:SentryFeedbackWidget] is to listen for specific Sentry events in the [code:beforeSend] callback and show the widget to users.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Dart',
              language: 'dart',
              code: getFeedbackConfigureSnippet(),
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

const logsOnboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Logs for Flutter are supported in SDK version [code:9.0.0] or higher. You can update your [pubspec:pubspec.yaml] to the matching version:',
            {
              code: <code />,
              pubspec: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'YAML',
              language: 'yaml',
              code: getManualInstallSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'If you are on an older major version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/dart/guides/flutter/migration/" />
              ),
            }
          ),
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
            'To enable logging, you need to initialize the SDK with the [code:enableLogs] option set to [code:true].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'dart',
          code: `await SentryFlutter.init(
  (options) {
    options.dsn = '${params.dsn.public}';
    // Enable logs to be sent to Sentry
    options.enableLogs = true;
  },
);`,
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
          text: t(
            'You can verify that logs are working by sending logs with the Sentry logger APIs.'
          ),
        },
        {
          type: 'code',
          language: 'dart',
          code: `Sentry.logger.fmt.info("Test log from %s", ["Sentry"])`,
        },
        {
          type: 'text',
          text: tct('For more details, check out our [link:logs documentation].', {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/dart/guides/flutter/logs/" />
            ),
          }),
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  crashReportOnboarding: crashReport,
  replayOnboarding,
  logsOnboarding,
};

export default docs;
