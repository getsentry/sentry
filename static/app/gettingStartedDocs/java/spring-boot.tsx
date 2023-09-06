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
      "Sentry's integration with [springBootLink:Spring Boot] supports Spring Boot 2.1.0 and above. If you're on an older version, use [legacyIntegrationLink:our legacy integration].",
      {
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
        description: (
          <p>
            {tct(
              'To see source context in Sentry, you have to generate an auth token by visiting the [link:Organization Auth Tokens] settings. You can then set the token as an environment variable that is used by the build plugins.',
              {
                link: (
                  <ExternalLink href="https://sentry.io/orgredirect/organizations/:orgslug/settings/auth-tokens/" />
                ),
              }
            )}
          </p>
        ),
        language: 'bash',
        code: `
SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___
            `,
      },
      {
        language: 'javascript', // TODO: This shouldn't be javascript but because of better formatting we use it for now
        description: <h5>{t('Gradle')}</h5>,
        configurations: [
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
        ],
      },
      {
        description: <h5>{t('Maven')}</h5>,
        additionalInfo: (
          <p>
            {tct(
              "There are two variants of Sentry available for Spring Boot. If you're using Spring Boot 2, use [springBootStarterLink:sentry-spring-boot-starter]. If you're using Spring Boot 3, use [springBootStarterJakartaLink:sentry-spring-boot-starter-jakarta] instead.",
              {
                springBootStarterLink: (
                  <ExternalLink href="https://github.com/getsentry/sentry-java/tree/master/sentry-spring-boot-starter" />
                ),
                springBootStarterJakartaLink: (
                  <ExternalLink href="https://github.com/getsentry/sentry-java/tree/master/sentry-spring-boot-starter-jakarta" />
                ),
              }
            )}
          </p>
        ),
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
            additionalInfo: (
              <p>
                {tct(
                  'If you use Logback for logging you may also want to send error logs to Sentry. Add a dependency to the [sentryLogbackCode:sentry-logback] module. Sentry Spring Boot Starter will auto-configure [sentryAppenderCode:SentryAppender].',
                  {sentryAppenderCode: <code />, sentryLogbackCode: <code />}
                )}
              </p>
            ),
          },
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

export const nextSteps = [
  {
    id: 'examples',
    name: t('Examples'),
    description: t('Check out our sample applications.'),
    link: 'https://github.com/getsentry/sentry-java/tree/main/sentry-samples',
  },
  {
    id: 'performance-monitoring',
    name: t('Performance Monitoring'),
    description: t(
      'Stay ahead of latency issues and trace every slow transaction to a poor-performing API call or database query.'
    ),
    link: 'https://docs.sentry.io/platforms/java/guides/spring-boot/performance/',
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
  const nextStepDocs = [...nextSteps];

  return (
    <Layout
      steps={steps({
        dsn,
        sourcePackageRegistries,
        projectSlug: projectSlug ?? '___PROJECT_SLUG___',
        organizationSlug: organization?.slug ?? '___ORG_SLUG___',
      })}
      nextSteps={nextStepDocs}
      introduction={introduction}
      {...props}
    />
  );
}

export default GettingStartedWithSpringBoot;
