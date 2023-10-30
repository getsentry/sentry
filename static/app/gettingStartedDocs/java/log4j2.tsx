import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {PlatformOption} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import {t, tct} from 'sentry/locale';

export enum PackageManager {
  GRADLE = 'gradle',
  MAVEN = 'maven',
}

type PlaformOptionKey = 'packageManager';

interface StepsParams {
  dsn: string;
  packageManager: PackageManager;
  organizationSlug?: string;
  projectSlug?: string;
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

export const steps = ({
  dsn,
  sourcePackageRegistries,
  projectSlug,
  organizationSlug,
  packageManager,
}: StepsParams): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t(
      "Install Sentry's integration with Log4j 2.x using %s:",
      packageManager === PackageManager.GRADLE ? 'Gradle' : 'Maven'
    ),
    configurations: [
      {
        description: (
          <p>
            {tct(
              'To see source context in Sentry, you have to generate an auth token by visiting the [link:Organization Auth Tokens] settings. You can then set the token as an environment variable that is used by the build plugins.',
              {
                link: <Link to="/settings/auth-tokens/" />,
              }
            )}
          </p>
        ),
        language: 'bash',
        code: 'SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___',
      },
      ...(packageManager === PackageManager.GRADLE
        ? [
            {
              description: (
                <p>
                  {tct(
                    'The [link:Sentry Gradle Plugin] automatically installs the Sentry SDK as well as available integrations for your dependencies. Add the following to your [code:build.gradle] file:',
                    {
                      code: <code />,
                      link: (
                        <ExternalLink href="https://github.com/getsentry/sentry-android-gradle-plugin" />
                      ),
                    }
                  )}
                </p>
              ),
              language: 'groovy',
              code: `
buildscript {
  repositories {
    mavenCentral()
  }
}

plugins {
  id "io.sentry.jvm.gradle" version "${
    sourcePackageRegistries?.isLoading
      ? t('\u2026loading')
      : sourcePackageRegistries?.data?.['sentry.java.android.gradle-plugin']?.version ??
        '3.12.0'
  }"
}

sentry {
  // Generates a JVM (Java, Kotlin, etc.) source bundle and uploads your source code to Sentry.
  // This enables source context, allowing you to see your source
  // code as part of your stack traces in Sentry.
  includeSourceContext = true

  org = "${organizationSlug}"
  projectName = "${projectSlug}"
  authToken = System.getenv("SENTRY_AUTH_TOKEN")
}
          `,
            },
          ]
        : []),
      ...(packageManager === PackageManager.MAVEN
        ? [
            {
              language: 'xml',
              partialLoading: sourcePackageRegistries?.isLoading,
              description: t("Add the Sentry SDK to your project's dependencies"),
              code: `
<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry-log4j2</artifactId>
  <version>${
    sourcePackageRegistries?.isLoading
      ? t('\u2026loading')
      : sourcePackageRegistries?.data?.['sentry.java.log4j2']?.version ?? '6.27.0'
  }</version>
</dependency>
          `,
            },
            {
              language: 'xml',
              partialLoading: sourcePackageRegistries?.isLoading,
              description: t(
                'To upload your source code to Sentry so it can be shown in stack traces, use our Maven plugin.'
              ),
              code: `
<build>
  <plugins>
    <plugin>
      <groupId>io.sentry</groupId>
      <artifactId>sentry-maven-plugin</artifactId>
      <version>${
        sourcePackageRegistries?.isLoading
          ? t('\u2026loading')
          : sourcePackageRegistries?.data?.['sentry.java.mavenplugin']?.version ?? '0.0.4'
      }</version>
      <configuration>
      <!-- for showing output of sentry-cli -->
      <debugSentryCli>true</debugSentryCli>

      <org>${organizationSlug}</org>

      <project>${projectSlug}</project>

      <!-- in case you're self hosting, provide the URL here -->
      <!--<url>http://localhost:8000/</url>-->

      <!-- provide your auth token via SENTRY_AUTH_TOKEN environment variable -->
      <authToken>\${env.SENTRY_AUTH_TOKEN}</authToken>
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
          ]
        : []),
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
              'The following example using the [log4j2Code:log4j2.xml] format to configure a [sentryConsoleAppenderCode:ConsoleAppender] that logs to standard out at the INFO level, and a [sentryAppenderCode:SentryAppender] that logs to the Sentry server at the ERROR level.',
              {
                log4j2Code: <code />,
                sentryConsoleAppenderCode: <code />,
                sentryAppenderCode: <code />,
              }
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
        language: 'java',
        code: [
          {
            language: 'java',
            label: 'Java',
            value: 'java',
            code: `
import java.lang.Exception;
import io.sentry.Sentry;

try {
  throw new Exception("This is a test.");
} catch (Exception e) {
  Sentry.captureException(e);
}`,
          },
          {
            language: 'java',
            label: 'Kotlin',
            value: 'kotlin',
            code: `
import java.lang.Exception
import io.sentry.Sentry

try {
  throw Exception("This is a test.")
} catch (e: Exception) {
  Sentry.captureException(e)
}`,
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
];

export const nextSteps = [
  {
    id: 'examples',
    name: t('Examples'),
    description: t('Check out our sample applications.'),
    link: 'https://github.com/getsentry/sentry-java/tree/main/sentry-samples',
  },
];
// Configuration End

export function GettingStartedWithLog4j2({
  dsn,
  sourcePackageRegistries,
  projectSlug,
  organization,
  ...props
}: ModuleProps) {
  const optionValues = useUrlPlatformOptions(platformOptions);
  const nextStepDocs = [...nextSteps];

  return (
    <Layout
      steps={steps({
        dsn,
        sourcePackageRegistries,
        projectSlug: projectSlug ?? '___PROJECT_SLUG___',
        organizationSlug: organization?.slug ?? '___ORG_SLUG___',
        packageManager: optionValues.packageManager as PackageManager,
      })}
      nextSteps={nextStepDocs}
      introduction={introduction}
      platformOptions={platformOptions}
      projectSlug={projectSlug}
      {...props}
    />
  );
}

export default GettingStartedWithLog4j2;
