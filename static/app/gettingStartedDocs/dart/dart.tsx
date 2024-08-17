import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
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
import exampleSnippets from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsExampleSnippets';
import {metricTagsExplanation} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
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

const getConfigureMetricsSnippet = (params: Params) => `
import 'package:sentry/sentry.dart';

Future<void> main() async {
 await Sentry.init((options) {
   options.dsn = '${params.dsn.public}';
   options.enableMetrics = true;
 },
);`;

const metricsOnboarding: OnboardingConfig = {
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      description: tct(
        'You need Sentry Dart SDK version [codeVersion:7.19.0] or higher. Learn more about installation methods in our [docsLink:full documentation].',
        {
          package: <code />,
          codeVersion: <code />,
          docsLink: <Link to={`/projects/${params.projectSlug}/getting-started/`} />,
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
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'To enable capturing metrics, you need to enable the metrics feature.'
      ),
      configurations: [
        {
          code: [
            {
              label: 'Dart',
              value: 'dart',
              language: 'dart',
              code: getConfigureMetricsSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        "Then you'll be able to add metrics as [codeCounters:counters], [codeSets:sets], [codeDistribution:distributions], and [codeGauge:gauges]. These are available under the [codeNamespace:Sentry.metrics()] namespace.",
        {
          codeCounters: <code />,
          codeSets: <code />,
          codeDistribution: <code />,
          codeGauge: <code />,
          codeNamespace: <code />,
        }
      ),
      configurations: [
        {
          description: metricTagsExplanation,
        },
        {
          description: t('Try out these examples:'),
          code: [
            {
              label: 'Counter',
              value: 'counter',
              language: 'dart',
              code: exampleSnippets.dart.counter,
            },
            {
              label: 'Distribution',
              value: 'distribution',
              language: 'dart',
              code: exampleSnippets.dart.distribution,
            },
            {
              label: 'Set',
              value: 'set',
              language: 'dart',
              code: exampleSnippets.dart.set,
            },
            {
              label: 'Gauge',
              value: 'gauge',
              language: 'dart',
              code: exampleSnippets.dart.gauge,
            },
          ],
        },
        {
          description: t(
            'It can take up to 3 minutes for the data to appear in the Sentry UI.'
          ),
        },
        {
          description: tct(
            'Learn more about metrics and how to configure them, by reading the [docsLink:docs].',
            {
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/dart/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
};

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
  customMetricsOnboarding: metricsOnboarding,
};

export default docs;
