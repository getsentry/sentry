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
dependencies:
  sentry_flutter: ^${getPackageVersion(params, 'sentry.dart.flutter', '7.8.0')}`;

const getConfigureSnippet = (params: Params) => `
import 'package:flutter/widgets.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

Future<void> main() async {
  await SentryFlutter.init(
    (options) {
      options.dsn = '${params.dsn}';
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // We recommend adjusting this value in production.
      options.tracesSampleRate = 1.0;
    },
    appRunner: () => runApp(MyApp()),
  );

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

const getPerformanceSnippet = () => `
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
          partialLoading: params.sourcePackageRegistries?.isLoading,
          code: getInstallSnippet(params),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct('Import [sentryFlutter: sentry_flutter] and initialize it', {
        sentryFlutter: <code />,
      }),
      configurations: [
        {
          language: 'dart',
          code: getConfigureSnippet(params),
          additionalInfo: tct(
            'You can configure the [sentryDsn: SENTRY_DSN], [sentryRelease: SENTRY_RELEASE], [sentryDist: SENTRY_DIST], and [sentryEnv: SENTRY_ENVIRONMENT] via the Dart environment variables passing the [dartDefine: --dart-define] flag to the compiler, as noted in the code sample.',
            {
              sentryDsn: <code />,
              sentryRelease: <code />,
              sentryDist: <code />,
              sentryEnv: <code />,
              dartDefine: <code />,
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
      title: t('Performance'),
      description: t(
        "You'll be able to monitor the performance of your app using the SDK. For example:"
      ),
      configurations: [
        {
          language: 'dart',
          code: getPerformanceSnippet(),
          additionalInfo: tct(
            'To learn more about the API and automatic instrumentations, check out the [perfDocs: performance documentation].',
            {
              perfDocs: (
                <ExternalLink href="https://docs.sentry.io/platforms/flutter/performance/instrumentation/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      name: t('Debug Symbols'),
      description: t(
        'We offer a range of methods to provide Sentry with debug symbols so that you can see symbolicated stack traces and triage issues faster.'
      ),
      link: 'https://docs.sentry.io/platforms/flutter/upload-debug/',
    },
    {
      name: t('Source Context'),
      description: t(
        "If Sentry has access to your application's source code, it can show snippets of code source context around the location of stack frames, which helps to quickly pinpoint problematic code."
      ),
      link: 'https://docs.sentry.io/platforms/flutter/upload-debug/#uploading-source-context-for-flutter-android-ios-and-macos',
    },
  ],
};

const docs: Docs = {
  onboarding,
};

export default docs;
