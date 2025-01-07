import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  BasePlatformOptions,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {feedbackOnboardingCrashApiJava} from 'sentry/gettingStartedDocs/java/java';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export enum PackageManager {
  GRADLE = 'gradle',
  MAVEN = 'maven',
}

export enum YesNo {
  YES = 'yes',
  NO = 'no',
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
  opentelemetry: {
    label: t('OpenTelemetry'),
    items: [
      {
        label: t('Combine Sentry with OpenTelemetry'),
        value: YesNo.YES,
      },
      {
        label: t('Do not use OpenTelemetry'),
        value: YesNo.NO,
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

const getOpenTelemetryRunSnippet = (params: Params) => `
SENTRY_PROPERTIES_FILE=sentry.properties java -javaagent:sentry-opentelemetry-agent-${getPackageVersion(params, 'sentry.java.opentelemetry-agent', '8.0.0')}.jar -jar your-application.jar
`;

const getSentryPropertiesSnippet = (params: Params) => `
dsn=${params.dsn.public}${
  params.isPerformanceSelected
    ? `
traces-sample-rate=1.0`
    : ''
}`;

const getConsoleAppenderSnippet = (params: Params) => `
<configuration>
  <!-- Configure the Console appender -->
  <appender name="Console" class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
      <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
    </encoder>
  </appender>

  <!-- Configure the Sentry appender, overriding the logging threshold to the WARN level -->
  <appender name="Sentry" class="io.sentry.logback.SentryAppender">${
    params.platformOptions.opentelemetry === YesNo.NO
      ? `
    <options>
      <dsn>${params.dsn.public}</dsn>
    </options>`
      : ''
  }
  </appender>

  <!-- Enable the Console and Sentry appenders, Console is provided as an example
  of a non-Sentry logger that is set to a different logging threshold -->
  <root level="INFO">
    <appender-ref ref="Console" />
    <appender-ref ref="Sentry" />
  </root>
</configuration>`;

const getLogLevelSnippet = (params: Params) => `
<appender name="Sentry" class="io.sentry.logback.SentryAppender">${
  params.platformOptions.opentelemetry === YesNo.NO
    ? `
  <options>
    <dsn>${params.dsn.public}</dsn>
  </options>`
    : ''
}
  <!-- Optionally change minimum Event level. Default for Events is ERROR -->
  <minimumEventLevel>WARN</minimumEventLevel>
  <!-- Optionally change minimum Breadcrumbs level. Default for Breadcrumbs is INFO -->
  <minimumBreadcrumbLevel>DEBUG</minimumBreadcrumbLevel>
</appender>`;

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

const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    tct(
      'The sentry-logback library provides Logback support for Sentry using an [link:Appender] that sends logged exceptions to Sentry.',
      {
        link: (
          <ExternalLink href="https://logback.qos.ch/apidocs/ch/qos/logback/core/Appender.html" />
        ),
      }
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      description: t(
        "Install Sentry's integration with Logback using %s:",
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
        ...(params.platformOptions.opentelemetry === YesNo.YES
          ? [
              {
                description: tct(
                  "When running your application, please add our [code:sentry-opentelemetry-agent] to the [code:java] command. You can download the latest version of the [code:sentry-opentelemetry-agent.jar] from [linkMC:MavenCentral]. It's also available as a [code:ZIP] containing the [code:JAR] used on this page on [linkGH:GitHub].",
                  {
                    code: <code />,
                    linkMC: (
                      <ExternalLink href="https://search.maven.org/artifact/io.sentry/sentry-opentelemetry-agent" />
                    ),
                    linkGH: (
                      <ExternalLink href="https://github.com/getsentry/sentry-java/releases/" />
                    ),
                  }
                ),
                language: 'bash',
                code: getOpenTelemetryRunSnippet(params),
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
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Configure Sentry as soon as possible in your application's lifecycle:"
      ),
      configurations: [
        ...(params.platformOptions.opentelemetry === YesNo.YES
          ? [
              {
                type: StepType.CONFIGURE,
                description: tct(
                  "Here's the [code:sentry.properties] file that goes with the [code:java] command above:",
                  {
                    code: <code />,
                  }
                ),
                configurations: [
                  {
                    language: 'java',
                    code: getSentryPropertiesSnippet(params),
                  },
                ],
              },
            ]
          : []),
        {
          language: 'xml',
          description: t(
            'The following example configures a ConsoleAppender that logs to standard out at the INFO level, and a SentryAppender that logs to the Sentry server at the ERROR level. This only an example of a non-Sentry appender set to a different logging threshold, similar to what you may already have in your project.'
          ),
          code: getConsoleAppenderSnippet(params),
          additionalInfo: tct(
            "You'll also need to configure your DSN (client key) if it's not already in the [code:logback.xml] configuration. Learn more in [link:our documentation for DSN configuration].",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/java/guides/logback/#dsn-configuration/" />
              ),
            }
          ),
        },
        {
          description: tct(
            "Next, you'll need to set your log levels, as illustrated here. You can learn more about [link:configuring log levels] in our documentation.",
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/java/guides/logback/#minimum-log-level/" />
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
              language: 'kotlin',
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
    {
      title: t('Other build tools'),
      additionalInfo: tct(
        'For other dependency managers see the [link:central Maven repository].',
        {
          link: (
            <ExternalLink href="https://search.maven.org/artifact/io.sentry/sentry-logback" />
          ),
        }
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
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboardingCrashApiJava,
  crashReportOnboarding: feedbackOnboardingCrashApiJava,
  platformOptions,
};

export default docs;
