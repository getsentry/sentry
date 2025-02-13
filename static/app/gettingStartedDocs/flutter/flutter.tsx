import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayMobileConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {feedbackOnboardingCrashApiDart} from 'sentry/gettingStartedDocs/dart/dart';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getInstallSnippet = (params: Params) => `
dependencies:
  sentry_flutter: ^${getPackageVersion(params, 'sentry.dart.flutter', '7.8.0')}`;

const getConfigureSnippet = (params: Params) => `
import 'package:sentry_flutter/sentry_flutter.dart';

Future<void> main() async {
  await SentryFlutter.init(
    (options) {
      options.dsn = '${params.dsn.public}';${
        params.isPerformanceSelected
          ? `
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
      // We recommend adjusting this value in production.
      options.tracesSampleRate = 1.0;`
          : ''
      }${
        params.isProfilingSelected
          ? `
      // The sampling rate for profiling is relative to tracesSampleRate
      // Setting to 1.0 will profile 100% of sampled transactions:
      options.profilesSampleRate = 1.0;`
          : ''
      }
    },
    appRunner: () => runApp(
      SentryWidget(
        child: MyApp(),
      ),
    ),
  );

  // or define SENTRY_DSN via Dart environment variable (--dart-define)
}`;

const configureAdditionalInfo = tct(
  'You can configure the [code: SENTRY_DSN], [code: SENTRY_RELEASE], [code: SENTRY_DIST], and [code: SENTRY_ENVIRONMENT] via the Dart environment variables passing the [code: --dart-define] flag to the compiler, as noted in the code sample.',
  {
    code: <code />,
  }
);

const getVerifySnippet = () => `
child: ElevatedButton(
  onPressed: () {
    throw Exception('This is test exception');
  },
  child: const Text('Verify Sentry Setup'),
)
`;

const getPerformanceSnippet = () => `
import 'package:sentry/sentry.dart';

void execute() async {
  final transaction = Sentry.startTransaction('processOrderBatch()', 'task');

  try {
    await processOrderBatch(transaction);
  } catch (exception) {
    transaction.throwable = exception;
    transaction.status = const SpanStatus.internalError();
  } finally {
    await transaction.finish();
  }
}

Future<void> processOrderBatch(ISentrySpan span) async {
  // span operation: task, span description: operation
  final innerSpan = span.startChild('task', description: 'operation');

  try {
    // omitted code
  } catch (exception) {
    innerSpan.throwable = exception;
    innerSpan.status = const SpanStatus.notFound();
  } finally {
    await innerSpan.finish();
  }
}`;

const getInstallReplaySnippet = () => `
await SentryFlutter.init(
  (options) {
    ...
    options.experimental.replay.sessionSampleRate = 1.0;
    options.experimental.replay.onErrorSampleRate = 1.0;
  },
  appRunner: () => runApp(
      SentryWidget(
        child: MyApp(),
      ),
    ),
);
`;

const getConfigureReplaySnippet = () => `
options.experimental.replay.maskAllText = true;
options.experimental.replay.maskAllImages = true;`;

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
          code: [
            {
              label: 'YAML',
              value: 'yaml',
              language: 'yaml',
              filename: 'pubspec.yaml',
              partialLoading: params.sourcePackageRegistries?.isLoading,
              code: getInstallSnippet(params),
            },
          ],
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
        ...(params.isProfilingSelected
          ? [
              {
                description: t(
                  'Flutter Profiling alpha is available for iOS and macOS since SDK version 7.12.0.'
                ),
              },
            ]
          : []),
        {
          code: [
            {
              label: 'Dart',
              value: 'dart',
              language: 'dart',
              filename: 'main.dart',
              code: getConfigureSnippet(params),
            },
          ],
          additionalInfo: params.isPerformanceSelected ? (
            <Fragment>
              <p>{configureAdditionalInfo}</p>
              <Alert margin={false} type="info">
                {t(
                  'To monitor performance, you need to add extra instrumentation as described in the Tracing section below.'
                )}
              </Alert>
            </Fragment>
          ) : (
            configureAdditionalInfo
          ),
        },
      ],
    },
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      description: t(
        'Create an intentional error, so you can test that everything is working. In the example below, pressing the button will throw an exception:'
      ),
      configurations: [
        {
          code: [
            {
              label: 'Dart',
              value: 'dart',
              language: 'dart',
              code: getVerifySnippet(),
            },
          ],
        },
      ],
    },
    ...(params.isPerformanceSelected
      ? [
          {
            title: t('Tracing'),
            description: t(
              "You'll be able to monitor the performance of your app using the SDK. For example:"
            ),
            configurations: [
              {
                code: [
                  {
                    label: 'Dart',
                    value: 'dart',
                    language: 'dart',
                    code: getPerformanceSnippet(),
                  },
                ],
                additionalInfo: tct(
                  'To learn more about the API and automatic instrumentations, check out the [perfDocs: tracing documentation].',
                  {
                    perfDocs: (
                      <ExternalLink href="https://docs.sentry.io/platforms/flutter/tracing/instrumentation/" />
                    ),
                  }
                ),
              },
            ],
          },
        ]
      : []),
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

const replayOnboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Make sure your Sentry Flutter SDK version is at least 8.9.0, which is required for Session Replay. You can update your [code:pubspec.yaml] to the matching version:',
        {code: <code />}
      ),
      configurations: [
        {
          code: [
            {
              label: 'YAML',
              value: 'yaml',
              language: 'yaml',
              code: getInstallSnippet(params),
            },
          ],
        },
        {
          description: t(
            'To set up the integration, add the following to your Sentry initialization:'
          ),
        },
        {
          code: [
            {
              label: 'Dart',
              value: 'dart',
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
      description: getReplayMobileConfigureDescription({
        link: 'https://docs.sentry.io/platforms/flutter/session-replay/#privacy',
      }),
      configurations: [
        {
          description: t(
            'The following code is the default configuration, which masks and blocks everything.'
          ),
          code: [
            {
              label: 'Dart',
              value: 'dart',
              language: 'dart',
              code: getConfigureReplaySnippet(),
            },
          ],
        },
      ],
    },
  ],
  verify: getReplayVerifyStep({
    replayOnErrorSampleRateName:
      'options\u200b.experimental\u200b.sessionReplay\u200b.onErrorSampleRate',
    replaySessionSampleRateName:
      'options\u200b.experimental\u200b.sessionReplay\u200b.sessionSampleRate',
  }),
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboardingCrashApiDart,
  crashReportOnboarding: feedbackOnboardingCrashApiDart,
  replayOnboarding,
};

export default docs;
