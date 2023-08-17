import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  dsn,
  sourcePackageRegistries,
}: Partial<
  Pick<ModuleProps, 'dsn' | 'sourcePackageRegistries'>
> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          'Sentry captures data by using an SDK within your application’s runtime. Add the following to your [pubspec: pubspec.yaml]',
          {
            pubspec: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'yml',
        partialLoading: sourcePackageRegistries?.isLoading,
        code: `
dependencies:
  sentry_flutter: ^${
    sourcePackageRegistries?.isLoading
      ? t('\u2026loading')
      : sourcePackageRegistries?.data?.['sentry.dart.flutter']?.version ?? '7.8.0'
  }
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct('Import [sentryFlutter: sentry_flutter] and initialize it', {
          sentryFlutter: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'dart',
        code: `
import 'package:flutter/widgets.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

Future<void> main() async {
  await SentryFlutter.init(
    (options) {
      options.dsn = '${dsn}';
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // We recommend adjusting this value in production.
      options.tracesSampleRate = 1.0;
    },
    appRunner: () => runApp(MyApp()),
  );

  // or define SENTRY_DSN via Dart environment variable (--dart-define)
}
        `,
        additionalInfo: (
          <p>
            {tct(
              'You can configure the [sentryDsn: SENTRY_DSN], [sentryRelease: SENTRY_RELEASE], [sentryDist: SENTRY_DIST], and [sentryEnv: SENTRY_ENVIRONMENT] via the Dart environment variables passing the [dartDefine: --dart-define] flag to the compiler, as noted in the code sample.',
              {
                sentryDsn: <code />,
                sentryRelease: <code />,
                sentryDist: <code />,
                sentryEnv: <code />,
                dartDefine: <code />,
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
      'Create an intentional error, so you can test that everything is working:'
    ),
    configurations: [
      {
        language: 'dart',
        code: `
import 'package:sentry/sentry.dart';

try {
  aMethodThatMightFail();
} catch (exception, stackTrace) {
  await Sentry.captureException(
    exception,
    stackTrace: stackTrace,
  );
}
        `,
        additionalInfo: (
          <p>
            {tct(
              "If you're new to Sentry, use the email alert to access your account and complete a product tour.[break] If you're an existing user and have disabled alerts, you won't receive this email.",
              {
                break: <br />,
              }
            )}
          </p>
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
        code: `
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
}
        `,
        additionalInfo: (
          <p>
            {tct(
              'To learn more about the API and automatic instrumentations, check out the [perfDocs: performance documentation].',
              {
                perfDocs: (
                  <ExternalLink href="https://docs.sentry.io/platforms/flutter/performance/instrumentation/" />
                ),
              }
            )}
          </p>
        ),
      },
    ],
  },
  {
    title: t('Debug Symbols'),
    configurations: [
      {
        description: t(
          'We offer a range of methods to provide Sentry with debug symbols so that you can see symbolicated stack traces and triage issues faster.'
        ),
      },
      {
        description: (
          <p>
            {tct(
              "Complete stack traces will be shown for your Dart error by default, but if you use [splitDebugInfo: split-debug-info] and [obfuscate: obfuscate], you'll need to [uploadDebugSymbols: upload the debug information files] generated by the [flutter: flutter] build.",
              {
                splitDebugInfo: <code />,
                obfuscate: <code />,
                uploadDebugSymbols: (
                  <ExternalLink href="https://docs.sentry.io/platforms/flutter/upload-debug/" />
                ),
                flutter: <code />,
              }
            )}
          </p>
        ),
      },
      {
        description: (
          <p>
            {tct(
              "You'll also need to [uploadDebug: upload the debug information files] generated by the [flutter: flutter] build for iOS, macOS, and Android NDK native crashes.",
              {
                uploadDebug: (
                  <ExternalLink href="https://docs.sentry.io/platforms/flutter/upload-debug/" />
                ),
                flutter: <code />,
              }
            )}
          </p>
        ),
      },
    ],
  },
  {
    title: t('Source Context'),
    configurations: [
      {
        description: (
          <p>
            {tct(
              "If Sentry has access to your application's source code, it can show snippets of code [sourceContext: source context] around the location of stack frames, which helps to quickly pinpoint problematic code.",
              {
                sourceContext: <i />,
              }
            )}
          </p>
        ),
      },
      {
        description: (
          <p>
            {tct(
              "To enable source context, you'll need to upload debug symbols to Sentry by following the [sourceContext: Uploading Source Code Context for Flutter Android, iOS, and macOS] guide.",
              {
                sourceContext: (
                  <ExternalLink href="https://docs.sentry.io/platforms/flutter/upload-debug/#uploading-source-code-context-for-flutter-android-ios-and-macos" />
                ),
              }
            )}
          </p>
        ),
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithFlutter({
  dsn,
  sourcePackageRegistries,
  ...props
}: ModuleProps) {
  return <Layout steps={steps({dsn, sourcePackageRegistries})} {...props} />;
}

export default GettingStartedWithFlutter;
