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
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export enum SpringVersion {
  V5 = 'v5',
  V6 = 'v6',
}

export enum PackageManager {
  GRADLE = 'gradle',
  MAVEN = 'maven',
}

const platformOptions = {
  springVersion: {
    label: t('Spring Version'),
    items: [
      {
        label: t('Spring 6'),
        value: SpringVersion.V6,
      },
      {
        label: t('Spring 5'),
        value: SpringVersion.V5,
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

const getMavenInstallSnippet = (params: Params) => `
<build>
  <plugins>
    <plugin>
      <groupId>io.sentry</groupId>
      <artifactId>sentry-maven-plugin</artifactId>
      <version>${
        params.sourcePackageRegistries?.isLoading
          ? t('\u2026loading')
          : params.sourcePackageRegistries?.data?.['sentry.java.maven-plugin']?.version ??
            '0.0.4'
      }</version>
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

const getJavaConfigSnippet = (params: Params) => `
import io.sentry.spring${
  params.platformOptions.springVersion === SpringVersion.V6 ? '.jakarta' : ''
}.EnableSentry;

@EnableSentry(dsn = "${params.dsn}")
@Configuration
class SentryConfiguration {
}`;

const getKotlinConfigSnippet = (params: Params) => `
import io.sentry.spring${
  params.platformOptions.springVersion === SpringVersion.V6 ? '.jakarta' : ''
}.EnableSentry
import org.springframework.core.Ordered

@EnableSentry(
  dsn = "${params.dsn}",
  exceptionResolverOrder = Ordered.LOWEST_PRECEDENCE
)`;

const getJavaVerifySnippet = () => `
import java.lang.Exception;
import io.sentry.Sentry;

try {
  throw new Exception("This is a test.");
} catch (Exception e) {
  Sentry.captureException(e);
}`;

const getKotlinVerifySnippet = () => `
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
      "Sentry's integration with Spring supports Spring Framework 5.1.2 and above. If you're on an older version, use [legacyIntegrationLink:our legacy integration].",
      {
        legacyIntegrationLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/java/guides/spring/legacy/" />
        ),
      }
    ),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: t(
        "Install Sentry's integration with Spring using %s:",
        params.platformOptions.packageManager === PackageManager.GRADLE
          ? 'Gradle'
          : 'Maven'
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
        ...(params.platformOptions.packageManager === PackageManager.GRADLE
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
                code: getGradleInstallSnippet(params),
              },
            ]
          : []),
        ...(params.platformOptions.packageManager === PackageManager.MAVEN
          ? [
              {
                language: 'xml',
                description: (
                  <p>
                    {tct(
                      'The [link:Sentry Maven Plugin] automatically installs the Sentry SDK as well as available integrations for your dependencies. Add the following to your [code:pom.xml] file:',
                      {
                        code: <code />,
                        link: (
                          <ExternalLink href="https://github.com/getsentry/sentry-maven-plugin" />
                        ),
                      }
                    )}
                  </p>
                ),
                code: getMavenInstallSnippet(params),
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
      description: (
        <Fragment>
          {t("Configure Sentry as soon as possible in your application's lifecycle:")}
          <p>
            {tct(
              'The [libraryName] library provides an [codeEnableSentry:@EnableSentry] annotation that registers all required Spring beans. [codeEnableSentry:@EnableSentry] can be placed on any class annotated with [configurationLink:@Configuration] including the main entry class in Spring Boot applications annotated with [springBootApplicationLink:@SpringBootApplication].',
              {
                libraryName: (
                  <code>
                    {params.platformOptions.springVersion === SpringVersion.V5
                      ? 'sentry-spring'
                      : 'sentry-spring-jakarta'}
                  </code>
                ),
                codeEnableSentry: <code />,
                configurationLink: (
                  <ExternalLink href="https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/context/annotation/Configuration.html" />
                ),
                springBootApplicationLink: (
                  <ExternalLink href="https://docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/autoconfigure/SpringBootApplication.html" />
                ),
              }
            )}
          </p>
        </Fragment>
      ),
      configurations: [
        {
          description: <h5>{t('Java')}</h5>,
          configurations: [
            {
              language: 'java',
              code: [
                {
                  language: 'java',
                  label: 'Java',
                  value: 'java',
                  code: getJavaConfigSnippet(params),
                },
                {
                  language: 'java',
                  label: 'Kotlin',
                  value: 'kotlin',
                  code: getKotlinConfigSnippet(params),
                },
              ],
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
          code: [
            {
              language: 'java',
              label: 'Java',
              value: 'java',
              code: getJavaVerifySnippet(),
            },
            {
              language: 'java',
              label: 'Kotlin',
              value: 'kotlin',
              code: getKotlinVerifySnippet(),
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
      link: 'https://docs.sentry.io/platforms/java/guides/spring/performance/',
    },
  ],
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  replayOnboardingJsLoader,
};

export default docs;
