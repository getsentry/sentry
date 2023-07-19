import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = tct(
  'The [code:sentry-log4j2] library provides [log4jLink:Log4j 2.x] support for Sentry via an [appenderLink:Appender] that sends logged exceptions to Sentry.',
  {
    log4jLink: <ExternalLink href="https://logging.apache.org/log4j/2.x//" />,
    appenderLink: (
      <ExternalLink href="https://logging.apache.org/log4j/2.x/manual/appenders.html" />
    ),
    code: <code />,
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
      "Install Sentry's integration with Log4j 2.x using either Maven or Gradle:"
    ),
    configurations: [
      {
        description: <h5>{t('Maven')}</h5>,
        configurations: [
          {
            language: 'xml',
            code: `
<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry-log4j2</artifactId>
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
        description: <h5>{t('Graddle')}</h5>,
        configurations: [
          {
            language: 'groovy',
            code: "implementation 'io.sentry:sentry-log4j2:6.25.2'",
          },
          {
            description: t(
              'To upload your source code to Sentry so it can be shown in stack traces, use our Gradle plugin.'
            ),
            language: 'groovy',
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
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      "Configure Sentry as soon as possible in your application's lifecycle:"
    ),
    configurations: [
      {
        language: 'xml',
        description: (
          <p>
            {tct(
              'The following example using the [log4j2Code:log4j2.xml] format to configure a [sentryAppenderCode:ConsoleAppender] that logs to standard out at the INFO level, and a [code:SentryAppender] that logs to the Sentry server at the ERROR level.',
              {log4j2Code: <code />, sentryAppenderCode: <code />}
            )}
          </p>
        ),
        code: `
<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="warn" packages="org.apache.logging.log4j.core,io.sentry.log4j2">
    <Appenders>
        <Console name="Console" target="SYSTEM_OUT">
            <PatternLayout pattern="%d{HH:mm:ss.SSS} [%t] %-5level %logger{36} - %msg%n"/>
        </Console>
        <Sentry name="Sentry"
                dsn=${dsn}>
    </Appenders>
    <Loggers>
        <Root level="info">
            <AppenderRef ref="Sentry"/>
            <AppenderRef ref="Console"/>
        </Root>
    </Loggers>
</Configuration>
        `,
        additionalInfo: (
          <p>
            {tct(
              "You'll also need to configure your DSN (client key) if it's not already in the [code:log4j2.xml] configuration. Learn more in [link:our documentation for DSN configuration].",
              {
                code: <code />,
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/java/guides/log4j2/#dsn-configuration" />
                ),
              }
            )}
          </p>
        ),
      },
      {
        description: (
          <p>
            {tct(
              "Next, you'll need to set your log levels, as illustrated here. You can learn more about [link:configuring log levels] in our documentation.",
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/java/guides/log4j2/#configure" />
                ),
              }
            )}
          </p>
        ),
        configurations: [
          {
            language: 'xml',
            code: `
<!-- Setting minimumBreadcrumbLevel modifies the default minimum level to add breadcrumbs from INFO to DEBUG  -->
<!-- Setting minimumEventLevel the default minimum level to capture an event from ERROR to WARN  -->
<Sentry name="Sentry"
        dsn="${dsn}"
        minimumBreadcrumbLevel="DEBUG"
        minimumEventLevel="WARN"
/>
          `,
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
];
// Configuration End

export function GettingStartedWithLog4j2({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithLog4j2;
