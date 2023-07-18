import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = tct(
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
);

export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t('Install the SDK via Gradle or Maven:'),
    configurations: [
      {
        language: 'groovy',
        description: (
          <p>
            {tct('For [strong:Gradle], add to your [code:build.gradle] file:', {
              strong: <strong />,
              code: <code />,
            })}
          </p>
        ),
        code: `
// Make sure mavenCentral is there.
repositories {
  mavenCentral()
}

dependencies {
  implementation 'io.sentry:sentry:{{@inject packages.version('sentry.java', '4.0.0') }}'
}
        `,
      },
      {
        language: 'xml',
        description: (
          <p>
            {tct('For [strong:Maven], add to your [code:pom.xml] file:', {
              strong: <strong />,
              code: <code />,
            })}
          </p>
        ),
        code: `
<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry</artifactId>
  <version>6.25.0</version>
</dependency>
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct("Configure Sentry as soon as possible in your application's lifecycle:", {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'kotlin',
        code: `
import io.sentry.Sentry

Sentry.init { options ->
  options.dsn = "${dsn}"
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production.
  options.tracesSampleRate = 1.0
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
}
        `,
      },
    ],
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
  {
    title: t('Measure Performance'),
    description: t('You can capture transactions using the SDK. For example:'),
    configurations: [
      {
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
}
        `,
      },
    ],
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
];
// Configuration End

export function GettingStartedWithKotlin({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithKotlin;
