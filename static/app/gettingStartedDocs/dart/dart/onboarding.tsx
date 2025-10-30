import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
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

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "Sentry captures data by using an SDK within your application's runtime. Add the following to your [pubspec:pubspec.yaml]",
            {
              pubspec: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'yml',
          code: getInstallSnippet(params),
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
          text: tct('Import [sentry:sentry] and initialize it', {sentry: <code />}),
        },
        {
          type: 'code',
          language: 'dart',
          code: getConfigureSnippet(params),
        },
        {
          type: 'text',
          text: tct(
            'You can configure the [code:SENTRY_DSN], [code:SENTRY_RELEASE], [code:SENTRY_DIST], and [code:SENTRY_ENVIRONMENT] via the Dart environment variables passing the [code:--dart-define] flag to the compiler, as noted in the code sample.',
            {code: <code />}
          ),
        },
      ],
    },
  ],
  verify: params => {
    const steps: OnboardingStep[] = [
      {
        type: StepType.VERIFY,
        content: [
          {
            type: 'text',
            text: t(
              'Create an intentional error, so you can test that everything is working:'
            ),
          },
          {
            type: 'code',
            language: 'dart',
            code: getVerifySnippet(params),
          },
          {
            type: 'text',
            text: [
              t(
                "If you're new to Sentry, use the email alert to access your account and complete a product tour."
              ),
              t(
                "If you're an existing user and have disabled alerts, you won't receive this email."
              ),
            ],
          },
        ],
      },
    ];

    if (params.isPerformanceSelected) {
      steps.push({
        title: t('Tracing'),
        content: [
          {
            type: 'text',
            text: t(
              "You'll be able to monitor the performance of your app using the SDK. For example:"
            ),
          },
          {
            type: 'code',
            language: 'dart',
            code: getPerfomanceSnippet(),
          },
          {
            type: 'text',
            text: tct(
              'To learn more about the API and automatic instrumentations, check out the [perfDocs:performance documentation].',
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
