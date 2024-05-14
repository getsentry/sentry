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
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export enum PackageManager {
  GRADLE = 'gradle',
  MAVEN = 'maven',
}

const packageManagerName: Record<PackageManager, string> = {
  [PackageManager.GRADLE]: 'Gradle',
  [PackageManager.MAVEN]: 'Maven',
};

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

const getConfigureSnippet = (params: Params) => `
import io.sentry.Sentry

Sentry.init { options ->
  options.dsn = "${params.dsn}"${
    params.isPerformanceSelected
      ? `
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production.
  options.tracesSampleRate = 1.0`
      : ''
  }
  // When first trying Sentry it's good to see what the SDK is doing:
  options.isDebug = true
}`;

const getVerifySnippet = () => `
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
      "Sentry supports Kotlin for both JVM and Android. This wizard guides you through set up in the JVM scenario. If you're interested in [strong:Android], head over to the [gettingStartedWithAndroidLink:Getting Started] for that SDK instead. At its core, Sentry for Java provides a raw client for sending events to Sentry. If you use [strong2:Spring Boot, Spring, Logback, JUL, or Log4j2], head over to our [gettingStartedWithJavaLink:Getting Started for Sentry Java].",
      {
        gettingStartedWithAndroidLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/android/" />
        ),
        gettingStartedWithJavaLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/java/" />
        ),
        strong: <strong />,
        strong2: <strong />,
      }
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      description: t(
        `Install the SDK via %s:`,
        packageManagerName[params.platformOptions.packageManager]
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
          code: `SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___`,
        },
        ...(params.platformOptions.packageManager === PackageManager.GRADLE
          ? [
              {
                language: 'groovy',
                partialLoading: params.sourcePackageRegistries.isLoading,
                description: tct(
                  'The [link:Sentry Gradle Plugin] automatically installs the Sentry SDK as well as available integrations for your dependencies. Add the following to your [code:build.gradle] file:',
                  {
                    code: <code />,
                    link: (
                      <ExternalLink href="https://github.com/getsentry/sentry-android-gradle-plugin" />
                    ),
                  }
                ),
                code: getGradleInstallSnippet(params),
              },
            ]
          : []),
        ...(params.platformOptions.packageManager === PackageManager.MAVEN
          ? [
              {
                language: 'xml',
                partialLoading: params.sourcePackageRegistries.isLoading,
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
          language: 'kotlin',
          code: getConfigureSnippet(params),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        'Trigger your first event from your development environment by intentionally creating an error with the [code:Sentry#captureException] method, to test that everything is working:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'kotlin',
          code: getVerifySnippet(),
          additionalInfo: (
            <Fragment>
              {t(
                "If you're new to Sentry, use the email alert to access your account and complete a product tour."
              )}
              <p>
                {t(
                  "If you're an existing user and have disabled alerts, you won't receive this email."
                )}
              </p>
            </Fragment>
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
    {
      id: 'performance-monitoring',
      name: t('Performance Monitoring'),
      description: t(
        'Stay ahead of latency issues and trace every slow transaction to a poor-performing API call or database query.'
      ),
      link: 'https://docs.sentry.io/platforms/java/performance/',
    },
  ],
};

const feedbackOnboardingCrashApi: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      description: getCrashReportInstallDescription(),
      configurations: [
        {
          code: [
            {
              label: 'Kotlin',
              value: 'kotlin',
              language: 'kotlin',
              code: `import io.sentry.kotlin.multiplatform.Sentry
import io.sentry.kotlin.multiplatform.protocol.UserFeedback

val sentryId = Sentry.captureMessage("My message")

val userFeedback = UserFeedback(sentryId).apply {
  comments = "It broke."
  email = "john.doe@example.com"
  name = "John Doe"
}
Sentry.captureUserFeedback(userFeedback)`,
            },
          ],
        },
      ],
    },
  ],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs<PlatformOptions> = {
  platformOptions,
  feedbackOnboardingCrashApi,
  crashReportOnboarding: feedbackOnboardingCrashApi,
  onboarding,
};

export default docs;
