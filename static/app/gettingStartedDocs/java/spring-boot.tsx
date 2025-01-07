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
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
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
SENTRY_AUTO_INIT=false java -javaagent:sentry-opentelemetry-agent-${getPackageVersion(params, 'sentry.java.opentelemetry-agent', '8.0.0')}.jar -jar your-application.jar
`;

const getConfigurationPropertiesSnippet = (params: Params) => `
sentry.dsn=${params.dsn.public}${
  params.isPerformanceSelected
    ? `
# Set traces-sample-rate to 1.0 to capture 100% of transactions for tracing.
# We recommend adjusting this value in production.
sentry.traces-sample-rate=1.0`
    : ''
}`;

const getConfigurationYamlSnippet = (params: Params) => `
sentry:
  dsn: ${params.dsn.public}${
    params.isPerformanceSelected
      ? `
  # Set traces-sample-rate to 1.0 to capture 100% of transactions for tracing.
  # We recommend adjusting this value in production.
  traces-sample-rate: 1.0`
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
              description: tct(
                'The [link:Sentry Maven Plugin] automatically installs the Sentry SDK as well as available integrations for your dependencies. Add the following to your [code:pom.xml] file:',
                {
                  code: <code />,
                  link: (
                    <ExternalLink href="https://github.com/getsentry/sentry-maven-plugin" />
                  ),
                }
              ),
              language: 'xml',
              code: getMavenInstallSnippet(params),
            },
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
      additionalInfo: (
        <p>
          {tct(
            'If you prefer to manually upload your source code to Sentry, please refer to [link:Manually Uploading Source Context].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/java/source-context/#manually-uploading-source-context" />
              ),
            }
          )}
        </p>
      ),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Open up [code:src/main/application.properties] (or [code:src/main/application.yml]) and configure the DSN, and any other settings you need:',
        {
          code: <code />,
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
  ],
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  replayOnboardingJsLoader,
  crashReportOnboarding: feedbackOnboardingCrashApiJava,
  feedbackOnboardingJsLoader,
};

export default docs;
