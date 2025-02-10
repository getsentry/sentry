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
dependencies:
  sentry: ^${getPackageVersion(params, 'sentry.dart', '7.8.0')}`;

const getConfigureSnippet = (params: Params) => `
import 'package:sentry/sentry.dart';

Future<void> main() async {
  await Sentry.init((options) {
    options.dsn = '${params.dsn.public}';
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
    // We recommend adjusting this value in production.
    options.tracesSampleRate = 1.0;
  });

  // or define SENTRY_DSN via Dart environment variable (--dart-define)
}`;

const getVerifySnippet = () => `
import 'package:sentry/sentry.dart';

try {
  aMethodThatMightFail();
} catch (exception, stackTrace) {
  await Sentry.captureException(
    exception,
    stackTrace: stackTrace,
  );
}`;

const getPerfomanceSnippet = () => `
import 'package:sentry/sentry.dart';
import { getPackageVersion } from 'sentry/utils/gettingStartedDocs/getPackageVersion';

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
          partialLoading: params.sourcePackageRegistries.isLoading,
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
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'Create an intentional error, so you can test that everything is working:'
      ),
      configurations: [
        {
          language: 'dart',
          code: getVerifySnippet(),
          additionalInfo: tct(
            "If you're new to Sentry, use the email alert to access your account and complete a product tour.[break] If you're an existing user and have disabled alerts, you won't receive this email.",
            {
              break: <br />,
            }
          ),
        },
      ],
    },
    {
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
    },
  ],
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

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboardingCrashApiDart,
  crashReportOnboarding: feedbackOnboardingCrashApiDart,
};

export default docs;
