import {ExternalLink, Link} from 'sentry/components/core/link';
import type {
  BasePlatformOptions,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
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
        label: t('With OpenTelemetry'),
        value: YesNo.YES,
      },
      {
        label: t('Without OpenTelemetry'),
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
  projectName = "${params.project.slug}"
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

        <project>${params.project.slug}</project>

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
dsn=${params.dsn.public}
# Add data like request headers and IP for users,
# see https://docs.sentry.io/platforms/java/guides/log4j2/data-management/data-collected/ for more info
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
<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="warn" packages="org.apache.logging.log4j.core,io.sentry.log4j2">
    <Appenders>
        <Console name="Console" target="SYSTEM_OUT">
            <PatternLayout pattern="%d{HH:mm:ss.SSS} [%t] %-5level %logger{36} - %msg%n"/>
        </Console>
        <Sentry name="Sentry"${
          params.platformOptions.opentelemetry === YesNo.NO
            ? `
                dsn=${params.dsn.public}`
            : ''
        }>
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
<!-- Setting minimumEventLevel the default minimum level to capture an event from ERROR to WARN  -->${
  params.isLogsSelected
    ? `
<!-- Setting minimumLevel configures which log messages are sent to Sentry -->`
    : ''
}
<Sentry name="Sentry"${
  params.platformOptions.opentelemetry === YesNo.NO
    ? `
        dsn=${params.dsn.public}`
    : ''
}
        minimumBreadcrumbLevel="DEBUG"
        minimumEventLevel="WARN"${
          params.isLogsSelected
            ? `
        minimumLevel="DEBUG"`
            : ''
        }
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

const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    tct(
      'The [code:sentry-log4j2] library provides [log4jLink:Log4j 2.x] support for Sentry via an [appenderLink:Appender] that sends logged exceptions to Sentry.',
      {
        log4jLink: <ExternalLink href="https://logging.apache.org/log4j/2.x/" />,
        appenderLink: (
          <ExternalLink href="https://logging.apache.org/log4j/2.x/manual/appenders.html" />
        ),
        code: <code />,
      }
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            "Install Sentry's integration with Log4j 2.x using %s:",
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
  configure: params => [
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
          text: tct(
            'The following example using the [code:log4j2.xml] format to configure a [code:ConsoleAppender] that logs to standard out at the INFO level, and a [code:SentryAppender] that logs to the Sentry server at the ERROR level.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'xml',
          code: getConsoleAppenderSnippet(params),
        },
        {
          type: 'conditional',
          condition: params.platformOptions.opentelemetry !== YesNo.YES,
          content: [
            {
              type: 'text',
              text: tct(
                "You'll also need to configure your DSN (client key) if it's not already in the [code:log4j2.xml] configuration. Learn more in [link:our documentation for DSN configuration].",
                {
                  code: <code />,
                  link: (
                    <ExternalLink href="https://docs.sentry.io/platforms/java/guides/log4j2/#dsn-configuration" />
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
                <ExternalLink href="https://docs.sentry.io/platforms/java/guides/log4j2/#configure" />
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

const logsOnboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "To start using logs, make sure your application uses Sentry Java SDK version [code:8.16.0] or higher. If you're on an older major version of the SDK, follow our [link:migration guide] to upgrade.",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/java/guides/log4j2/migration/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable logging, you need to initialize the SDK with the [code:logs.enabled] option in your [code:sentry.properties] file or when you call [code:Sentry.init].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'sentry.properties',
              language: 'properties',
              code: `logs.enabled=true`,
            },
            {
              label: 'Java',
              language: 'java',
              code: `import io.sentry.Sentry;

Sentry.init(options -> {
  options.setDsn("${params.dsn.public}");
  options.getLogs().setEnabled(true);
});`,
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              code: `import io.sentry.Sentry

Sentry.init { options ->
  options.dsn = "${params.dsn.public}"
  options.logs.enabled = true
}`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'You may also set [code:minimumLevel] in [code:log4j2.xml] to configure which log messages are sent to Sentry.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'log4j2.xml',
              language: 'xml',
              code: `<Sentry
  name="Sentry"
  dsn="${params.dsn.public}"
  minimumLevel="DEBUG"
/>
`,
            },
          ],
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
          text: tct(
            'Once the handler is configured with logging enabled, any logs at or above the [code:minimumLevel] will be sent to Sentry.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'java',
          code: `import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class SentryLog4jExample {
  public static void main(String[] args) {
    Logger logger = LogManager.getRootLogger();
    logger.info("A %s test log message", "formatted");
  }
}`,
        },
      ],
    },
  ],
};

const docs: Docs<PlatformOptions> = {
  platformOptions,
  feedbackOnboardingCrashApi: feedbackOnboardingCrashApiJava,
  crashReportOnboarding: feedbackOnboardingCrashApiJava,
  onboarding,
  logsOnboarding,
};

export default docs;
