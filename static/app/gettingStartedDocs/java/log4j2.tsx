import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  BasePlatformOptions,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export enum PackageManager {
  GRADLE = 'gradle',
  MAVEN = 'maven',
}

const platformOptions = {
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
} satisfies BasePlatformOptions;

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const getGradleInstallSnippet = (params: Params) => `
buildscript {
  repositories {
    mavenCentral()
  }
}

plugins {
  id "io.sentry.jvm.gradle" version "${getPackageVersion(
    params,
    'sentry.java.android.gradle-plugin',
    '3.12.0'
  )}"
}

sentry {
  // Generates a JVM (Java, Kotlin, etc.) source bundle and uploads your source code to Sentry.
  // This enables source context, allowing you to see your source
  // code as part of your stack traces in Sentry.
  includeSourceContext = true

  org = "${params.organization.slug}"
  projectName = "${params.projectSlug}"
  authToken = System.getenv("SENTRY_AUTH_TOKEN")
}`;

const getMavenInstallSnippet = (params: Params) => `
<build>
  <plugins>
    <plugin>
      <groupId>io.sentry</groupId>
      <artifactId>sentry-maven-plugin</artifactId>
      <version>${getPackageVersion(params, 'sentry.java.maven-plugin', '0.0.4')}</version>
      <extensions>true</extensions>
      <configuration>
        <!-- for showing output of sentry-cli -->
        <debugSentryCli>true</debugSentryCli>

        <org>${params.organization.slug}</org>

        <project>${params.projectSlug}</project>

        <!-- in case you're self hosting, provide the URL here -->
        <!--<url>http://localhost:8000/</url>-->

        <!-- provide your auth token via SENTRY_AUTH_TOKEN environment variable -->
        <authToken>\${env.SENTRY_AUTH_TOKEN}</authToken>
      </configuration>
      <executions>
        <execution>
          <goals>
            <!--
            Generates a JVM (Java, Kotlin, etc.) source bundle and uploads your source code to Sentry.
            This enables source context, allowing you to see your source
            code as part of your stack traces in Sentry.
            -->
            <goal>uploadSourceBundle</goal>
          </goals>
        </execution>
      </executions>
    </plugin>
  </plugins>
  ...
</build>`;

const getConsoleAppenderSnippet = (params: Params) => `
<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="warn" packages="org.apache.logging.log4j.core,io.sentry.log4j2">
    <Appenders>
        <Console name="Console" target="SYSTEM_OUT">
            <PatternLayout pattern="%d{HH:mm:ss.SSS} [%t] %-5level %logger{36} - %msg%n"/>
        </Console>
        <Sentry name="Sentry"
                dsn=${params.dsn}>
    </Appenders>
    <Loggers>
        <Root level="info">
            <AppenderRef ref="Sentry"/>
            <AppenderRef ref="Console"/>
        </Root>
    </Loggers>
</Configuration>`;

const getLogLevelSnippet = (params: Params) => `
<!-- Setting minimumBreadcrumbLevel modifies the default minimum level to add breadcrumbs from INFO to DEBUG  -->
<!-- Setting minimumEventLevel the default minimum level to capture an event from ERROR to WARN  -->
<Sentry name="Sentry"
        dsn="${params.dsn}"
        minimumBreadcrumbLevel="DEBUG"
        minimumEventLevel="WARN"
/>`;

const getVerifyJavaSnippet = () => `
import java.lang.Exception;
import io.sentry.Sentry;

try {
  throw new Exception("This is a test.");
} catch (Exception e) {
  Sentry.captureException(e);
}`;

const getVerifyKotlinSnippet = () => `
import java.lang.Exception
import io.sentry.Sentry

try {
  throw Exception("This is a test.")
} catch (e: Exception) {
  Sentry.captureException(e)
}`;

const introduction = (
  <p>
    {tct(
      'The [code:sentry-log4j2] library provides [log4jLink:Log4j 2.x] support for Sentry via an [appenderLink:Appender] that sends logged exceptions to Sentry.',
      {
        log4jLink: <ExternalLink href="https://logging.apache.org/log4j/2.x//" />,
        appenderLink: (
          <ExternalLink href="https://logging.apache.org/log4j/2.x/manual/appenders.html" />
        ),
        code: <code />,
      }
    )}
  </p>
);

const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () => introduction,
  install: params => [
    {
      type: StepType.INSTALL,
      description: t(
        "Install Sentry's integration with Log4j 2.x using %s:",
        params.platformOptions.packageManager === PackageManager.GRADLE
          ? 'Gradle'
          : 'Maven'
      ),
      configurations: [
        {
          description: tct(
            'To see source context in Sentry, you have to generate an auth token by visiting the [link:Organization Auth Tokens] settings. You can then set the token as an environment variable that is used by the build plugins.',
            {
              link: <Link to="/settings/auth-tokens/" />,
            }
          ),
          language: 'bash',
          code: 'SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___',
        },
        ...(params.platformOptions.packageManager === PackageManager.GRADLE
          ? [
              {
                description: tct(
                  'The [link:Sentry Gradle Plugin] automatically installs the Sentry SDK as well as available integrations for your dependencies. Add the following to your [code:build.gradle] file:',
                  {
                    code: <code />,
                    link: (
                      <ExternalLink href="https://github.com/getsentry/sentry-android-gradle-plugin" />
                    ),
                  }
                ),
                language: 'groovy',
                code: getGradleInstallSnippet(params),
              },
            ]
          : []),
        ...(params.platformOptions.packageManager === PackageManager.MAVEN
          ? [
              {
                language: 'xml',
                partialLoading: params.sourcePackageRegistries?.isLoading,
                description: tct(
                  'The [link:Sentry Maven Plugin] automatically installs the Sentry SDK as well as available integrations for your dependencies. Add the following to your [code:pom.xml] file:',
                  {
                    code: <code />,
                    link: (
                      <ExternalLink href="https://github.com/getsentry/sentry-maven-plugin" />
                    ),
                  }
                ),
                code: getMavenInstallSnippet(params),
              },
            ]
          : []),
      ],
      additionalInfo: tct(
        'If you prefer to manually upload your source code to Sentry, please refer to [link:Manually Uploading Source Context].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/java/source-context/#manually-uploading-source-context" />
          ),
        }
      ),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Configure Sentry as soon as possible in your application's lifecycle:"
      ),
      configurations: [
        {
          language: 'xml',
          description: tct(
            'The following example using the [log4j2Code:log4j2.xml] format to configure a [sentryConsoleAppenderCode:ConsoleAppender] that logs to standard out at the INFO level, and a [sentryAppenderCode:SentryAppender] that logs to the Sentry server at the ERROR level.',
            {
              log4j2Code: <code />,
              sentryConsoleAppenderCode: <code />,
              sentryAppenderCode: <code />,
            }
          ),
          code: getConsoleAppenderSnippet(params),
          additionalInfo: tct(
            "You'll also need to configure your DSN (client key) if it's not already in the [code:log4j2.xml] configuration. Learn more in [link:our documentation for DSN configuration].",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/java/guides/log4j2/#dsn-configuration" />
              ),
            }
          ),
        },
        {
          description: tct(
            "Next, you'll need to set your log levels, as illustrated here. You can learn more about [link:configuring log levels] in our documentation.",
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/java/guides/log4j2/#configure" />
              ),
            }
          ),
          configurations: [
            {
              language: 'xml',
              code: getLogLevelSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'Last, create an intentional error, so you can test that everything is working:'
      ),
      configurations: [
        {
          language: 'java',
          code: [
            {
              language: 'java',
              label: 'Java',
              value: 'java',
              code: getVerifyJavaSnippet(),
            },
            {
              language: 'java',
              label: 'Kotlin',
              value: 'kotlin',
              code: getVerifyKotlinSnippet(),
            },
          ],
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
  ],
  nextSteps: () => [
    {
      id: 'examples',
      name: t('Examples'),
      description: t('Check out our sample applications.'),
      link: 'https://github.com/getsentry/sentry-java/tree/main/sentry-samples',
    },
  ],
};

const docs: Docs<PlatformOptions> = {
  platformOptions,
  onboarding,
};

export default docs;
