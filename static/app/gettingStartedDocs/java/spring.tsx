import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = tct(
  "There are two variants of Sentry available for Spring. If you're using Spring 5, use [sentrySpringLink:sentry-spring]. If you're using Spring 6, use [sentrySpringJakartaLink:sentry-spring-jakarta] instead. Sentry's integration with Spring supports Spring Framework 5.1.2 and above to report unhandled exceptions and optional user information. If you're on an older version, use [legacyIntegrationLink:our legacy integration].",
  {
    sentrySpringLink: (
      <ExternalLink href="https://github.com/getsentry/sentry-java/tree/master/sentry-spring" />
    ),
    sentrySpringJakartaLink: (
      <ExternalLink href="https://github.com/getsentry/sentry-java/tree/master/sentry-spring-jakarta" />
    ),
    legacyIntegrationLink: (
      <ExternalLink href="https://docs.sentry.io/platforms/java/guides/spring/legacy/" />
    ),
  }
);

export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t(
      "Install Sentry's integration with Spring using either Maven or Gradle:"
    ),
    configurations: [
      {
        description: <h5>{t('Maven')}</h5>,
        configurations: [
          {
            language: 'xml',
            description: <strong>{t('Spring 5')}</strong>,
            code: `
<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry-spring</artifactId>
  <version>6.25.2</version>
</dependency>
          `,
          },
          {
            language: 'xml',
            description: <strong>{t('Spring 6')}</strong>,
            code: `
<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry-spring-jakarta</artifactId>
  <version>6.25.2</version>
</dependency>
        `,
          },
        ],
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <Fragment>
        {t("Configure Sentry as soon as possible in your application's lifecycle:")}
        <p>
          {tct(
            'The [codeSentrySpring:sentry-spring] and [codeSentrySpringJakarta:sentry-spring-jakarta] libraries provide an [codeEnableSentry:@EnableSentry] annotation that registers all required Spring beans. [codeEnableSentry:@EnableSentry] can be placed on any class annotated with [configurationLink:@Configuration] including the main entry class in Spring Boot applications annotated with [springBootApplicationLink:@SpringBootApplication].',
            {
              codeSentrySpring: <code />,
              codeSentrySpringJakarta: <code />,
              codeEnableSentry: <code />,
              configurationLink: (
                <ExternalLink href="https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/context/annotation/Configuration.html" />
              ),
              springBootApplicationLink: (
                <ExternalLink href="https://docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/autoconfigure/SpringBootApplication.html" />
              ),
            }
          )}
        </p>
      </Fragment>
    ),
    configurations: [
      {
        description: <h5>{t('Java')}</h5>,
        configurations: [
          {
            language: 'java',
            description: <strong>{t('Spring 5')}</strong>,
            code: `
import io.sentry.spring.EnableSentry;

@EnableSentry(dsn = "${dsn}")
@Configuration
class SentryConfiguration {
}
          `,
          },
          {
            language: 'java',
            description: <strong>{t('Spring 6')}</strong>,
            code: `
import io.sentry.spring.jakarta.EnableSentry;

@EnableSentry(dsn = "${dsn}")
@Configuration
class SentryConfiguration {
}
        `,
          },
        ],
      },
      {
        description: <h5>{t('Kotlin')}</h5>,
        configurations: [
          {
            language: 'java',
            description: <strong>{t('Spring 5')}</strong>,
            code: `
import io.sentry.spring.EnableSentry
import org.springframework.core.Ordered

@EnableSentry(
  dsn = "${dsn}",
  exceptionResolverOrder = Ordered.LOWEST_PRECEDENCE
)
          `,
          },
          {
            language: 'java',
            description: <strong>{t('Spring 6')}</strong>,
            code: `
import io.sentry.spring.jakarta.EnableSentry
import org.springframework.core.Ordered

@EnableSentry(
  dsn = "${dsn}",
  exceptionResolverOrder = Ordered.LOWEST_PRECEDENCE
)
        `,
          },
        ],
      },
      {
        description: <h5>{t('Source Context')}</h5>,
        configurations: [
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
        `,
          },
        ],
      },
      {
        description: <h5>{t('Graddle')}</h5>,
        configurations: [
          {
            description: <strong>{t('Spring 5')}</strong>,
            language: 'groovy',
            code: `implementation 'io.sentry:sentry-spring:6.25.2'`,
          },
          {
            description: <strong>{t('Spring 6')}</strong>,
            language: 'groovy',
            code: `implementation 'io.sentry:sentry-spring-jakarta:6.25.2'`,
          },
        ],
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'Last, create an intentional error, so you can test that everything is working:'
    ),
    configurations: [
      {
        description: <h5>Java</h5>,
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
      {
        description: <h5>Kotlin</h5>,
        language: 'java',
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
    title: t('Source Context'),
    configurations: [
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

    additionalInfo: (
      <p>
        {tct(
          'For other dependency managers see the [mavenRepositorySpring5Link:central Maven repository (Spring 5)] and [mavenRepositorySpring6Link:central Maven repository (Spring 6)].',
          {
            mavenRepositorySpring5Link: (
              <ExternalLink href="https://central.sonatype.com/artifact/io.sentry/sentry-spring/6.26.0" />
            ),
            mavenRepositorySpring6Link: (
              <ExternalLink href="https://central.sonatype.com/artifact/io.sentry/sentry-spring-jakarta/6.26.0" />
            ),
          }
        )}
      </p>
    ),
  },
  {
    title: t('Measure Performance'),
    description: (
      <p>
        {tct(
          'Check out [link:the documentation] to learn how to configure and use Sentry Performance Monitoring with Spring.',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/java/guides/spring/performance/" />
            ),
          }
        )}
      </p>
    ),
  },
];
// Configuration End

export function GettingStartedWithSpring({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithSpring;
