import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = tct(
  'Sentry for Java is a collection of modules provided by Sentry; it supports Java 1.8 and above. At its core, Sentry for Java provides a raw client for sending events to Sentry. If you use [strong:Spring Boot, Spring, Logback, or Log4j2], we recommend visiting our Sentry Java documentation for installation instructions.',
  {
    strong: <strong />,
    link: <ExternalLink href="https://docs.sentry.io/platforms/java/" />,
  }
);

export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t('Install the SDK via Gradle, Maven, or SBT:'),
    configurations: [
      {
        description: <h5>{t('Gradle')}</h5>,
        configurations: [
          {
            language: 'groovy',
            description: (
              <p>
                {tct('For Gradle, add to your [code:build.gradle] file:', {
                  code: <code />,
                })}
              </p>
            ),
            code: `
// Make sure mavenCentral is there.
repositories {
    mavenCentral()
}

// Add Sentry's SDK as a dependency.
dependencies {
    implementation 'io.sentry:sentry:6.25.2'
}
          `,
          },
          {
            language: 'groovy',
            description: t(
              'To upload your source code to Sentry so it can be shown in stack traces, use our Gradle plugin.'
            ),
            code: `
buildscript {
  repositories {
    mavenCentral()
  }
}

plugins {
  id "io.sentry.jvm.gradle" version "3.11.1"
}

sentry {
  // Generates a JVM (Java, Kotlin, etc.) source bundle and uploads your source code to Sentry.
  // This enables source context, allowing you to see your source
  // code as part of your stack traces in Sentry.
  includeSourceContext = true

  org = "___ORG_SLUG___"
  projectName = "___PROJECT_SLUG___"
  authToken = "your-sentry-auth-token"
}
        `,
          },
        ],
      },
      {
        description: <h5>{t('Maven')}</h5>,
        configurations: [
          {
            language: 'xml',
            description: (
              <p>
                {tct('For Maven, add to your [code:pom.xml] file:', {code: <code />})}
              </p>
            ),
            code: `
<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry</artifactId>
  <version>6.25.2</version>
</dependency>
            `,
          },
          {
            language: 'xml',
            description: t(
              'To upload your source code to Sentry so it can be shown in stack traces, use our Maven plugin.'
            ),
            code: `
<build>
  <plugins>
    <plugin>
      <groupId>io.sentry</groupId>
      <artifactId>sentry-maven-plugin</artifactId>
      <version>0.0.2</version>
      <configuration>
      <!-- for showing output of sentry-cli -->
      <debugSentryCli>true</debugSentryCli>

      <!-- download the latest sentry-cli and provide path to it here -->
      <!-- download it here: https://github.com/getsentry/sentry-cli/releases -->
      <!-- minimum required version is 2.17.3 -->
      <sentryCliExecutablePath>/path/to/sentry-cli</sentryCliExecutablePath>

      <org>___ORG_SLUG___</org>

      <project>___PROJECT_SLUG___</project>

      <!-- in case you're self hosting, provide the URL here -->
      <!--<url>http://localhost:8000/</url>-->

      <!-- provide your auth token via SENTRY_AUTH_TOKEN environment variable -->
      <!-- you can find it in Sentry UI: Settings > Account > API > Auth Tokens -->
      <authToken>env.SENTRY_AUTH_TOKEN</authToken>
      </configuration>
      <executions>
        <execution>
            <phase>generate-resources</phase>
            <goals>
                <goal>uploadSourceBundle</goal>
            </goals>
        </execution>
      </executions>
    </plugin>
  </plugins>
...
</build>
            `,
          },
        ],
      },
      {
        description: <h5>{t('SBT')}</h5>,
        configurations: [
          {
            description: <p>{tct('For [strong:SBT]:', {strong: <strong />})}</p>,
            language: 'scala',
            code: `libraryDependencies += "io.sentry" % "sentry" % "6.25.2"`,
          },
        ],
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'To upload your source code to Sentry so it can be shown in stack traces, please refer to [link:Manually Uploading Source Context].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/java/source-context/" />
            ),
          }
        )}
      </p>
    ),
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      "Configure Sentry as soon as possible in your application's lifecycle:"
    ),
    configurations: [
      {
        language: 'java',
        code: `
import io.sentry.Sentry;

Sentry.init(options -> {
  options.setDsn("${dsn}");
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production.
  options.setTracesSampleRate(1.0);
  // When first trying Sentry it's good to see what the SDK is doing:
  options.setDebug(true);
});
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
        language: 'java',
        code: `
import java.lang.Exception;
import io.sentry.Sentry;

try {
  throw new Exception("This is a test.");
} catch (Exception e) {
  Sentry.captureException(e);
}
      `,
      },
    ],
    additionalInfo: (
      <Fragment>
        <p>
          {t(
            "If you're new to Sentry, use the email alert to access your account and complete a product tour."
          )}
        </p>
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
        language: 'java',
        code: `
import io.sentry.ITransaction;
import io.sentry.Sentry;
import io.sentry.SpanStatus;

// A good name for the transaction is key, to help identify what this is about
ITransaction transaction = Sentry.startTransaction("processOrderBatch()", "task");
try {
processOrderBatch();
} catch (Exception e) {
transaction.setThrowable(e);
transaction.setStatus(SpanStatus.INTERNAL_ERROR);
throw e;
} finally {
transaction.finish();
}
        `,
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'For more information about the API and automatic instrumentations included in the SDK, [link:visit the docs].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/java/performance/" />
            ),
          }
        )}
      </p>
    ),
  },
];
// Configuration End

export function GettingStartedWithJava({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithJava;
