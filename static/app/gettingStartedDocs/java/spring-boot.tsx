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

export enum SpringBootVersion {
  V2 = 'v2',
  V3 = 'v3',
}

export enum PackageManager {
  GRADLE = 'gradle',
  MAVEN = 'maven',
}

const platformOptions = {
  springBootVersion: {
    label: t('Spring Boot Version'),
    items: [
      {
        label: t('Spring Boot 3'),
        value: SpringBootVersion.V3,
      },
      {
        label: t('Spring Boot 2'),
        value: SpringBootVersion.V2,
      },
    ],
  },
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

const getMavenInstallSnippet = (params: Params) =>
  params.platformOptions.springBootVersion === SpringBootVersion.V3
    ? `
<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry-spring-boot-starter-jakarta</artifactId>
  <version>${getPackageVersion(
    params,
    'sentry.java.spring-boot.jakarta',
    '6.28.0'
  )}</version>
</dependency>`
    : `
<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry-spring-boot-starter</artifactId>
  <version>${
    params.sourcePackageRegistries?.isLoading
      ? t('\u2026loading')
      : params.sourcePackageRegistries?.data?.['sentry.java.spring-boot']?.version ??
        '6.28.0'
  }</version>
</dependency>`;

const getLogbackInstallSnippet = (params: Params) => `
<dependency>
    <groupId>io.sentry</groupId>
    <artifactId>sentry-logback</artifactId>
    <version>${getPackageVersion(params, 'sentry.java.logback', '6.28.0')}</version>
</dependency>`;

const getMavenPluginSnippet = (params: Params) => `
<build>
  <plugins>
    <plugin>
      <groupId>io.sentry</groupId>
      <artifactId>sentry-maven-plugin</artifactId>
      <version>${
        params.sourcePackageRegistries?.isLoading
          ? t('\u2026loading')
          : params.sourcePackageRegistries?.data?.['sentry.java.mavenplugin']?.version ??
            '0.0.4'
      }</version>
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
          <phase>generate-resources</phase>
          <goals>
            <goal>uploadSourceBundle</goal>
          </goals>
        </execution>
      </executions>
    </plugin>
  </plugins>
...
</build>`;

const getConfigurationPropertiesSnippet = (params: Params) => `
sentry.dsn=${params.dsn}${
  params.isPerformanceSelected
    ? `
# Set traces-sample-rate to 1.0 to capture 100% of transactions for performance monitoring.
# We recommend adjusting this value in production.
sentry.traces-sample-rate=1.0`
    : ''
}`;

const getConfigurationYamlSnippet = (params: Params) => `
sentry:
  dsn: ${params.dsn}${
    params.isPerformanceSelected
      ? `
  # Set traces-sample-rate to 1.0 to capture 100% of transactions for performance monitoring.
  # We recommend adjusting this value in production.
  sentry.traces-sample-rate: 1.0`
      : ''
  }`;

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
      "Sentry's integration with [springBootLink:Spring Boot] supports Spring Boot 2.1.0 and above. If you're on an older version, use [legacyIntegrationLink:our legacy integration].",
      {
        springBootLink: <ExternalLink href="https://spring.io/projects/spring-boot" />,
        legacyIntegrationLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/java/legacy/spring/" />
        ),
      }
    ),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      configurations: [
        {
          description: tct(
            'To see source context in Sentry, you have to generate an auth token by visiting the [link:Organization Auth Tokens] settings. You can then set the token as an environment variable that is used by the build plugins.',
            {
              link: <Link to="/settings/auth-tokens/" />,
            }
          ),
          language: 'bash',
          code: `SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___`,
        },
        params.platformOptions.packageManager === PackageManager.GRADLE
          ? {
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
            }
          : {
              description: t('Install using Maven:'),
              configurations: [
                {
                  language: 'xml',
                  partialLoading: params.sourcePackageRegistries?.isLoading,
                  code: getMavenInstallSnippet(params),
                  additionalInfo: tct(
                    'If you use Logback for logging you may also want to send error logs to Sentry. Add a dependency to the [sentryLogbackCode:sentry-logback] module. Sentry Spring Boot Starter will auto-configure [sentryAppenderCode:SentryAppender].',
                    {sentryAppenderCode: <code />, sentryLogbackCode: <code />}
                  ),
                },
                {
                  language: 'xml',
                  code: getLogbackInstallSnippet(params),
                },
                {
                  language: 'xml',
                  description: t(
                    'To upload your source code to Sentry so it can be shown in stack traces, use our Maven plugin.'
                  ),
                  code: getMavenPluginSnippet(params),
                },
              ],
            },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Open up [applicationPropertiesCode:src/main/application.properties] (or [applicationYmlCode:src/main/application.yml]) and configure the DSN, and any other settings you need:',
        {
          applicationPropertiesCode: <code />,
          applicationYmlCode: <code />,
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'Properties',
              value: 'properties',
              language: 'properties',
              code: getConfigurationPropertiesSnippet(params),
            },
            {
              label: 'YAML',
              value: 'yaml',
              language: 'properties',
              code: getConfigurationYamlSnippet(params),
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
        'Then create an intentional error, so you can test that everything is working using either Java or Kotlin:'
      ),
      configurations: [
        {
          code: [
            {
              label: 'Java',
              value: 'java',
              language: 'javascript', // TODO: This shouldn't be javascript but because of better formatting we use it for now
              code: getVerifyJavaSnippet(),
            },
            {
              label: 'Kotlin',
              value: 'kotlin',
              language: 'javascript', // TODO: This shouldn't be javascript but because of better formatting we use it for now
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
    {
      id: 'performance-monitoring',
      name: t('Performance Monitoring'),
      description: t(
        'Stay ahead of latency issues and trace every slow transaction to a poor-performing API call or database query.'
      ),
      link: 'https://docs.sentry.io/platforms/java/guides/spring-boot/performance/',
    },
  ],
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
};

export default docs;
