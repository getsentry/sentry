import {ExternalLink} from 'sentry/components/core/link';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getInstallSnippet = (params: Params) => `
dependencies:
  sentry: ^${getPackageVersion(params, 'sentry.dart', '9.6.0')}`;

const getConfigureSnippet = (params: Params) => `
import 'package:sentry/sentry.dart';

Future<void> main() async {
  await Sentry.init((options) {
    options.dsn = '${params.dsn.public}';
    // Adds request headers and IP for users,
    // visit: https://docs.sentry.io/platforms/dart/data-management/data-collected/ for more info
    options.sendDefaultPii = true;${
      params.isLogsSelected
        ? `
    // Enable logs to be sent to Sentry
    options.enableLogs = true;`
        : ''
    }${
      params.isPerformanceSelected
        ? `
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
    // We recommend adjusting this value in production.
    options.tracesSampleRate = 1.0;`
        : ''
    }
  });

  // or define SENTRY_DSN via Dart environment variable (--dart-define)
}`;

const getVerifySnippet = (params: Params) => {
  const logsCode = params.isLogsSelected
    ? `
  // Send a log before throwing the error
  Sentry.logger.info("User triggered test error", {
    'action': SentryLogAttribute.string('test_error'),
  });`
    : '';
  return `
import 'package:sentry/sentry.dart';

try {${logsCode}
  aMethodThatMightFail();
} catch (exception, stackTrace) {
  await Sentry.captureException(
    exception,
    stackTrace: stackTrace,
  );
}`;
};

const getPerfomanceSnippet = () => `
import 'package:sentry/sentry.dart';

final transaction = Sentry.startTransaction('processOrderBatch()', 'task');

try {
  await processOrderBatch(transaction);
} catch (exception) {
  transaction.throwable = exception;
  transaction.status = SpanStatus.internalError();
} finally {
  await transaction.finish();
}

Future<void> processOrderBatch(ISentrySpan span) async {
  // span operation: task, span description: operation
  final innerSpan = span.startChild('task', description: 'operation');

  try {
    // omitted code
  } catch (exception) {
    innerSpan.throwable = exception;
    innerSpan.status = SpanStatus.notFound();
  } finally {
    await innerSpan.finish();
  }
}`;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Sentry captures data by using an SDK within your application’s runtime. Add the following to your [pubspec: pubspec.yaml]',
        {
          pubspec: <code />,
        }
      ),
      configurations: [
        {
          language: 'yml',
          code: getInstallSnippet(params),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct('Import [sentry: sentry] and initialize it', {
        sentry: <code />,
      }),
      configurations: [
        {
          language: 'dart',
          code: getConfigureSnippet(params),
          additionalInfo: tct(
            'You can configure the [code: SENTRY_DSN], [code: SENTRY_RELEASE], [code: SENTRY_DIST], and [code: SENTRY_ENVIRONMENT] via the Dart environment variables passing the [code: --dart-define] flag to the compiler, as noted in the code sample.',
            {
              code: <code />,
            }
          ),
        },
      ],
    },
  ],
  verify: params => {
    const steps: OnboardingStep[] = [
      {
        type: StepType.VERIFY,
        description: t(
          'Create an intentional error, so you can test that everything is working:'
        ),
        configurations: [
          {
            language: 'dart',
            code: getVerifySnippet(params),
            additionalInfo: tct(
              "If you're new to Sentry, use the email alert to access your account and complete a product tour.[break] If you're an existing user and have disabled alerts, you won't receive this email.",
              {
                break: <br />,
              }
            ),
          },
        ],
      },
    ];

    if (params.isPerformanceSelected) {
      steps.push({
        title: t('Tracing'),
        description: t(
          "You'll be able to monitor the performance of your app using the SDK. For example:"
        ),
        configurations: [
          {
            language: 'dart',
            code: getPerfomanceSnippet(),
            additionalInfo: tct(
              'To learn more about the API and automatic instrumentations, check out the [perfDocs: performance documentation].',
              {
                perfDocs: (
                  <ExternalLink href="https://docs.sentry.io/platforms/dart/tracing/instrumentation/" />
                ),
              }
            ),
          },
        ],
      });
    }

    return steps;
  },
  nextSteps: params => {
    const steps = [
      {
        name: t('Upload Debug Symbols'),
        description: t(
          'We offer a range of methods to provide Sentry with debug symbols so that you can see symbolicated stack traces and find the cause of your errors faster.'
        ),
        link: 'https://docs.sentry.io/platforms/flutter/upload-debug/',
      },
      {
        name: t('Connect your Git Repo'),
        description: t(
          'Adding our Git integrations will allow us determine suspect commits, comment on PRs, and create links directly to your source code from Sentry issues.'
        ),
        link: 'https://docs.sentry.io/organization/integrations/source-code-mgmt/',
      },
    ];

    if (params.isLogsSelected) {
      steps.push({
        name: t('Structured Logs'),
        description: t(
          'Learn how to send structured logs to Sentry and view them alongside your errors.'
        ),
        link: 'https://docs.sentry.io/platforms/dart/logs/',
      });
    }

    return steps;
  },
};

export const feedbackOnboardingCrashApiDart: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      description: getCrashReportInstallDescription(),
      configurations: [
        {
          code: [
            {
              label: 'Dart',
              value: 'dart',
              language: 'dart',
              code: `import 'package:sentry/sentry.dart';

SentryId sentryId = Sentry.captureMessage("My message");

final userFeedback = SentryUserFeedback(
    eventId: sentryId,
    comments: 'Hello World!',
    email: 'foo@bar.org',
    name: 'John Doe',
);

Sentry.captureUserFeedback(userFeedback);`,
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
            'Logs for Dart are supported in SDK version [code:9.0.0] or higher. You can update your [pubspec:pubspec.yaml] to the matching version:',
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
              code: getInstallSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'If you are on an older major version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/dart/migration/" />
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
          code: `await Sentry.init(
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
            link: <ExternalLink href="https://docs.sentry.io/platforms/dart/logs/" />,
          }),
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboardingCrashApiDart,
  crashReportOnboarding: feedbackOnboardingCrashApiDart,
  logsOnboarding,
};

export default docs;
