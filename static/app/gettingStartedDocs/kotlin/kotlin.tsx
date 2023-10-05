import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  PlatformOption,
  useUrlPlatformOptions,
} from 'sentry/components/onboarding/platformOptionsControl';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

export enum PackageManager {
  GRADLE = 'gradle',
  MAVEN = 'maven',
}

type PlaformOptionKey = 'packageManager';

interface StepsParams {
  dsn: string;
  hasPerformance: boolean;
  packageManager: PackageManager;
  sourcePackageRegistries?: ModuleProps['sourcePackageRegistries'];
}

// Configuration Start
const platformOptions: Record<PlaformOptionKey, PlatformOption> = {
  packageManager: {
    label: t('Package Manager'),
    items: [
      {
        label: t('Gradle'),
        value: PackageManager.GRADLE,
      },
      {
        label: t('Maven'),
        value: PackageManager.MAVEN,
      },
    ],
  },
};
const introduction = (
  <p>
    {tct(
      "Sentry supports Kotlin for both JVM and [Android. This wizard guides you through set up in the JVM scenario. If you're interested in [strong:Android], head over to the [gettingStartedWithAndroidLink:Getting Started] for that SDK instead. At its core, Sentry for Java provides a raw client for sending events to Sentry. If you use [strong:Spring Boot, Spring, Logback, JUL, or Log4j2], head over to our [gettingStartedWithJavaLink:Getting Started for Sentry Java].",
      {
        gettingStartedWithAndroidLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/android/" />
        ),
        gettingStartedWithJavaLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/java/" />
        ),
        strong: <strong />,
      }
    )}
  </p>
);

export const steps = ({
  dsn,
  sourcePackageRegistries,
  hasPerformance,
  packageManager,
}: StepsParams): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    configurations:
      packageManager === PackageManager.GRADLE
        ? [
            {
              language: 'groovy',
              description: (
                <p>
                  {tct('Add the Sentry SDK to your [code:build.gradle] file:', {
                    code: <code />,
                  })}
                </p>
              ),
              partialLoading: sourcePackageRegistries?.isLoading,
              code: `
// Make sure mavenCentral is there.
repositories {
  mavenCentral()
}

dependencies {
  implementation 'io.sentry:sentry:${
    sourcePackageRegistries?.isLoading
      ? t('\u2026loading')
      : sourcePackageRegistries?.data?.['sentry.java']?.version ?? '4.0.0'
  }'
}
        `,
            },
          ]
        : [
            {
              language: 'xml',
              partialLoading: sourcePackageRegistries?.isLoading,
              description: (
                <p>
                  {tct('Add the Sentry SDK to your [code:pom.xml] file:', {
                    code: <code />,
                  })}
                </p>
              ),
              code: `
<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry</artifactId>
  <version>${
    sourcePackageRegistries?.isLoading
      ? t('\u2026loading')
      : sourcePackageRegistries?.data?.['sentry.java']?.version ?? '6.25.0'
  }</version>
</dependency>
        `,
            },
          ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      "Configure Sentry as soon as possible in your application's lifecycle:"
    ),
    configurations: [
      {
        language: 'kotlin',
        code: `
import io.sentry.Sentry

Sentry.init { options ->
  options.dsn = "${dsn}"${
    hasPerformance
      ? `
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production.
  options.tracesSampleRate = 1.0`
      : ''
  }
  // When first trying Sentry it's good to see what the SDK is doing:
  options.isDebug = true
}
        `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: (
      <p>
        {tct(
          'Trigger your first event from your development environment by intentionally creating an error with the [code:Sentry#captureException] method, to test that everything is working:',
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'kotlin',
        code: `
import java.lang.Exception
import io.sentry.Sentry

try {
  throw Exception("This is a test.")
} catch (e: Exception) {
  Sentry.captureException(e)
}`,
        additionalInfo: (
          <Fragment>
            {t(
              "If you're new to Sentry, use the email alert to access your account and complete a product tour."
            )}
            <p>
              {t(
                "If you're an existing user and have disabled alerts, you won't receive this email."
              )}
            </p>
          </Fragment>
        ),
      },
      ...(hasPerformance
        ? [
            {
              description: <h5>{t('Measure Performance')}</h5>,
              configurations: [
                {
                  description: t(
                    'You can capture transactions using the SDK. For example:'
                  ),
                  language: 'kotlin',
                  code: `
import io.sentry.Sentry
import io.sentry.SpanStatus

// A good name for the transaction is key, to help identify what this is about
val transaction = Sentry.startTransaction("processOrderBatch()", "task")
try {
  processOrderBatch()
} catch (e: Exception) {
  transaction.throwable = e
  transaction.status = SpanStatus.INTERNAL_ERROR
throw e
} finally {
  transaction.finish();
}`,
                  additionalInfo: (
                    <p>
                      {tct(
                        'For more information about the API and automatic instrumentations included in the SDK, visit the docs.',
                        {
                          docsLink: (
                            <ExternalLink href="https://docs.sentry.io/platforms/java/performance/" />
                          ),
                        }
                      )}
                    </p>
                  ),
                },
              ],
            },
          ]
        : []),
    ],
  },
];
// Configuration End

export function GettingStartedWithKotlin({
  dsn,
  sourcePackageRegistries,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const optionValues = useUrlPlatformOptions(platformOptions);
  const hasPerformance = activeProductSelection.includes(
    ProductSolution.PERFORMANCE_MONITORING
  );
  return (
    <Layout
      steps={steps({
        dsn,
        sourcePackageRegistries,
        packageManager: optionValues.packageManager as PackageManager,
        hasPerformance,
      })}
      introduction={introduction}
      platformOptions={platformOptions}
      {...props}
    />
  );
}

export default GettingStartedWithKotlin;
