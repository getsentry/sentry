import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

interface StepProps {
  dsn: string;
  organizationSlug?: string;
  projectSlug?: string;
  sourcePackageRegistries?: ModuleProps['sourcePackageRegistries'];
}

// Configuration Start
const introduction = (
  <p>
    {tct(
      "There are two variants of Sentry available for Spring Boot. If you're using Spring Boot 2, use [springBootStarterLink:sentry-spring-boot-starter]. If you're using Spring Boot 3, use [springBootStarterJakartaLink:sentry-spring-boot-starter-jakarta] instead. Sentry's integration with [springBootLink:Spring Boot] supports Spring Boot 2.1.0 and above to report unhandled exceptions as well as release and registration of beans. If you're on an older version, use [legacyIntegrationLink:our legacy integration].",
      {
        springBootStarterLink: (
          <ExternalLink href="https://github.com/getsentry/sentry-java/tree/master/sentry-spring-boot-starter" />
        ),
        springBootStarterJakartaLink: (
          <ExternalLink href="https://github.com/getsentry/sentry-java/tree/master/sentry-spring-boot-starter-jakarta" />
        ),
        springBootLink: <ExternalLink href="https://spring.io/projects/spring-boot" />,
        legacyIntegrationLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/java/legacy/spring/" />
        ),
      }
    )}
  </p>
);

export const steps = ({
  dsn,
  sourcePackageRegistries,
  projectSlug,
  organizationSlug,
}: StepProps): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t('Install using either Maven or Gradle:'),
    configurations: [
      {
        language: 'javascript', // TODO: This shouldn't be javascript but because of better formatting we use it for now
        description: <h5>{t('Gradle')}</h5>,
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
  authToken = "your-sentry-auth-token"
}
        `,
      },
      {
        description: <h5>{t('Maven')}</h5>,
        configurations: [
          {
            language: 'xml',
            partialLoading: sourcePackageRegistries?.isLoading,
            description: <strong>{t('Spring Boot 2')}</strong>,
            code: `
<dependency>
    <groupId>io.sentry</groupId>
    <artifactId>sentry-spring-boot-starter</artifactId>
    <version>${
      sourcePackageRegistries?.isLoading
        ? t('\u2026loading')
        : sourcePackageRegistries?.data?.['sentry.java.spring-boot']?.version ?? '6.28.0'
    }</version>
</dependency>
          `,
          },
          {
            language: 'xml',
            partialLoading: sourcePackageRegistries?.isLoading,
            description: <strong>{t('Spring Boot 3')}</strong>,
            code: `
<dependency>
    <groupId>io.sentry</groupId>
    <artifactId>sentry-spring-boot-starter-jakarta</artifactId>
    <version>${
      sourcePackageRegistries?.isLoading
        ? t('\u2026loading')
        : sourcePackageRegistries?.data?.['sentry.java.spring-boot.jakarta']?.version ??
          '6.28.0'
    }</version>
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
      <p>
        {tct(
          'Open up [applicationPropertiesCode:src/main/application.properties] (or [applicationYmlCode:src/main/application.yml]) and configure the DSN, and any other settings you need:',
          {
            applicationPropertiesCode: <code />,
            applicationYmlCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'properties',
        description: (
          <p>{tct('Modify [code:src/main/application.properties]:', {code: <code />})}</p>
        ),
        code: `
sentry.dsn=${dsn}
# Set traces-sample-rate to 1.0 to capture 100% of transactions for performance monitoring.
# We recommend adjusting this value in production.
sentry.traces-sample-rate=1.0
        `,
      },
      {
        language: 'properties',
        description: (
          <p>{tct('Or, modify [code:src/main/application.yml]:', {code: <code />})}</p>
        ),
        code: `
sentry:
  dsn:${dsn}
  # Set traces-sample-rate to 1.0 to capture 100% of transactions for performance monitoring.
  # We recommend adjusting this value in production.
  traces-sample-rate: 1.0
        `,
        additionalInfo: (
          <p>
            {tct(
              'If you use Logback for logging you may also want to send error logs to Sentry. Add a dependency to the [sentryLogbackCode:sentry-logback] module using either Maven or Gradle. Sentry Spring Boot Starter will auto-configure [sentryAppenderCode:SentryAppender].',
              {sentryAppenderCode: <code />, sentryLogbackCode: <code />}
            )}
          </p>
        ),
      },
      {
        description: <h5>{t('Maven')}</h5>,
        configurations: [
          {
            language: 'xml',
            code: `
<dependency>
    <groupId>io.sentry</groupId>
    <artifactId>sentry-logback</artifactId>
    <version>${
      sourcePackageRegistries?.isLoading
        ? t('\u2026loading')
        : sourcePackageRegistries?.data?.['sentry.java.logback']?.version ?? '6.28.0'
    }</version>
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
        <!-- you can find it in Sentry UI: Settings > Account > API > Auth Tokens -->
        <authToken>env.SENTRY_AUTH_TOKEN}</authToken>
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
        description: <h5>{t('Gradle')}</h5>,
        configurations: [
          {
            language: 'properties',
            partialLoading: sourcePackageRegistries?.isLoading,
            code: `implementation 'io.sentry:sentry-logback:${
              sourcePackageRegistries?.isLoading
                ? t('\u2026loading')
                : sourcePackageRegistries?.data?.['sentry.java.logback']?.version ??
                  '6.28.0'
            }'`,
          },
        ],
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'Then create an intentional error, so you can test that everything is working using either Java or Kotlin:'
    ),
    configurations: [
      {
        description: <h5>Java</h5>,
        language: 'javascript', // TODO: This shouldn't be javascript but because of better formatting we use it for now
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
        language: 'javascript', // TODO: This shouldn't be javascript but because of better formatting we use it for now
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

export function GettingStartedWithSpringBoot({
  dsn,
  sourcePackageRegistries,
  projectSlug,
  organization,
  ...props
}: ModuleProps) {
  return (
    <Layout
      steps={steps({
        dsn,
        sourcePackageRegistries,
        projectSlug: projectSlug ?? '___PROJECT_SLUG___',
        organizationSlug: organization?.slug ?? '___ORG_SLUG___',
      })}
      introduction={introduction}
      {...props}
    />
  );
}

export default GettingStartedWithSpringBoot;
