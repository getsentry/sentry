import {ExternalLink, Link} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

import {PackageManager, type PlatformOptions} from './utils';

type Params = DocsParams<PlatformOptions>;

const packageManagerName: Record<PackageManager, string> = {
  [PackageManager.GRADLE]: 'Gradle',
  [PackageManager.MAVEN]: 'Maven',
};

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

const getConfigureSnippet = (params: Params) => `
import io.sentry.Sentry

Sentry.init { options ->
  options.dsn = "${params.dsn.public}"${
    params.isPerformanceSelected
      ? `
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
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

export const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    tct(
      "Sentry supports Kotlin for both JVM and Android. This wizard guides you through set up in the JVM scenario. If you're interested in [strong:Android], head over to the [gettingStartedWithAndroidLink:Getting Started] for that SDK instead. At its core, Sentry for Java provides a raw client for sending events to Sentry. If you use [strong:Spring Boot, Spring, Logback, JUL, or Log4j2], head over to our [gettingStartedWithJavaLink:Getting Started for Sentry Java].",
      {
        gettingStartedWithAndroidLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/android/" />
        ),
        gettingStartedWithJavaLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/java/" />
        ),
        strong: <strong />,
      }
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            `Install the SDK via %s:`,
            packageManagerName[params.platformOptions.packageManager]
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
          code: `SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___`,
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
          type: 'code',
          language: 'kotlin',
          code: getConfigureSnippet(params),
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
            'Trigger your first event from your development environment by intentionally creating an error with the [code:Sentry#captureException] method, to test that everything is working:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'kotlin',
          code: getVerifySnippet(),
        },
        {
          type: 'text',
          text: [
            t(
              "If you're new to Sentry, use the email alert to access your account and complete a product tour."
            ),
            t(
              "If you're an existing user and have disabled alerts, you won't receive this email."
            ),
          ],
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
