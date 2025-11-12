import {ExternalLink, Link} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getGradleInstallSnippet,
  getMavenInstallSnippet,
  getOpenTelemetryRunSnippet,
  getVerifyJavaSnippet,
  getVerifyKotlinSnippet,
  PackageManager,
  YesNo,
} from 'sentry/gettingStartedDocs/java/utils';
import {t, tct} from 'sentry/locale';

import {type Params, type PlatformOptions} from './utils';

const getSentryPropertiesSnippet = (params: Params) => `
dsn=${params.dsn.public}
# Add data like request headers and IP for users,
# see https://docs.sentry.io/platforms/java/guides/logback/data-management/data-collected/ for more info
send-default-pii=true${
  params.isLogsSelected
    ? `
# Enable sending logs to Sentry
logs.enabled=true`
    : ''
}${
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
      <!-- Add data like request headers and IP for users, see https://docs.sentry.io/platforms/java/guides/logback/data-management/data-collected/ for more info -->
      <sendDefaultPii>true</sendDefaultPii>${
        params.isLogsSelected
          ? `
      <logs>
        <enabled>true</enabled>
      </logs>`
          : ''
      }
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
    <!-- Add data like request headers and IP for users, see https://docs.sentry.io/platforms/java/guides/logback/data-management/data-collected/ for more info -->
    <sendDefaultPii>true</sendDefaultPii>${
      params.isLogsSelected
        ? `
    <logs>
      <enabled>true</enabled>
    </logs>`
        : ''
    }
  </options>`
    : ''
}
  <!-- Optionally change minimum Event level. Default for Events is ERROR -->
  <minimumEventLevel>WARN</minimumEventLevel>
  <!-- Optionally change minimum Breadcrumbs level. Default for Breadcrumbs is INFO -->
  <minimumBreadcrumbLevel>DEBUG</minimumBreadcrumbLevel>${
    params.isLogsSelected
      ? `
  <!-- Optionally change minimum Log level. Default for Log Events is INFO -->
  <minimumLevel>DEBUG</minimumLevel>`
      : ''
  }
</appender>`;

export const onboarding: OnboardingConfig<PlatformOptions> = {
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
      content: [
        {
          type: 'text',
          text: t(
            "Install Sentry's integration with Logback using %s:",
            params.platformOptions.packageManager === PackageManager.GRADLE
              ? 'Gradle'
              : 'Maven'
          ),
        },
        {
          type: 'text',
          text: tct(
            'To see source context in Sentry, you have to generate an auth token by visiting the [link:Organization Tokens] settings. You can then set the token as an environment variable that is used by the build plugins.',
            {
              link: <Link to={`/settings/${params.organization.slug}/auth-tokens/`} />,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___',
        },
        {
          type: 'conditional',
          condition: params.platformOptions.packageManager === PackageManager.GRADLE,
          content: [
            {
              type: 'text',
              text: tct(
                'The [link:Sentry Gradle Plugin] automatically installs the Sentry SDK as well as available integrations for your dependencies. Add the following to your [code:build.gradle] file:',
                {
                  code: <code />,
                  link: (
                    <ExternalLink href="https://github.com/getsentry/sentry-android-gradle-plugin" />
                  ),
                }
              ),
            },
            {
              type: 'code',
              language: 'groovy',
              code: getGradleInstallSnippet(params),
            },
          ],
        },
        {
          type: 'conditional',
          condition: params.platformOptions.packageManager === PackageManager.MAVEN,
          content: [
            {
              type: 'text',
              text: tct(
                'The [link:Sentry Maven Plugin] automatically installs the Sentry SDK as well as available integrations for your dependencies. Add the following to your [code:pom.xml] file:',
                {
                  code: <code />,
                  link: (
                    <ExternalLink href="https://github.com/getsentry/sentry-maven-plugin" />
                  ),
                }
              ),
            },
            {
              type: 'code',
              language: 'xml',
              code: getMavenInstallSnippet(params),
            },
          ],
        },
        {
          type: 'conditional',
          condition: params.platformOptions.opentelemetry === YesNo.YES,
          content: [
            {
              type: 'text',
              text: tct(
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
            },
            {
              type: 'code',
              language: 'bash',
              code: getOpenTelemetryRunSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'If you prefer to manually upload your source code to Sentry, please refer to [link:Manually Uploading Source Context].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/java/source-context/#manually-uploading-source-context" />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            "Configure Sentry as soon as possible in your application's lifecycle:"
          ),
        },
        {
          type: 'conditional',
          condition: params.platformOptions.opentelemetry === YesNo.YES,
          content: [
            {
              type: 'text',
              text: tct(
                "Here's the [code:sentry.properties] file that goes with the [code:java] command above:",
                {
                  code: <code />,
                }
              ),
            },
            {
              type: 'code',
              language: 'properties',
              code: getSentryPropertiesSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'The following example configures a ConsoleAppender that logs to standard out at the INFO level, and a SentryAppender that logs to the Sentry server at the ERROR level. This only an example of a non-Sentry appender set to a different logging threshold, similar to what you may already have in your project.'
          ),
        },
        {
          type: 'code',
          language: 'xml',
          code: getConsoleAppenderSnippet(params),
        },
        {
          type: 'conditional',
          condition: params.platformOptions.opentelemetry === YesNo.NO,
          content: [
            {
              type: 'text',
              text: tct(
                "You'll also need to configure your DSN (client key) if it's not already in the [code:logback.xml] configuration. Learn more in [link:our documentation for DSN configuration].",
                {
                  code: <code />,
                  link: (
                    <ExternalLink href="https://docs.sentry.io/platforms/java/guides/logback/#configure" />
                  ),
                }
              ),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            "Next, you'll need to set your log levels, as illustrated here. You can learn more about [link:configuring log levels] in our documentation.",
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/java/guides/logback/#minimum-log-level" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'xml',
          code: getLogLevelSnippet(params),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Last, create an intentional error, so you can test that everything is working:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Java',
              language: 'java',
              code: getVerifyJavaSnippet(),
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              code: getVerifyKotlinSnippet(),
            },
          ],
        },
        {
          type: 'text',
          text: t(
            "If you're new to Sentry, use the email alert to access your account and complete a product tour."
          ),
        },
        {
          type: 'text',
          text: t(
            "If you're an existing user and have disabled alerts, you won't receive this email."
          ),
        },
      ],
    },
    {
      title: t('Other build tools'),
      content: [
        {
          type: 'text',
          text: tct(
            'For other dependency managers see the [link:central Maven repository].',
            {
              link: (
                <ExternalLink href="https://search.maven.org/artifact/io.sentry/sentry-logback" />
              ),
            }
          ),
        },
      ],
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
