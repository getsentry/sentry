import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {PlatformOption} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import {t, tct} from 'sentry/locale';

export enum SpringVersion {
  V5 = 'v5',
  V6 = 'v6',
}

export enum PackageManager {
  GRADLE = 'gradle',
  MAVEN = 'maven',
}

type PlaformOptionKey = 'springVersion' | 'packageManager';

interface StepsParams {
  dsn: string;
  packageManager: PackageManager;
  springVersion: SpringVersion;
  organizationSlug?: string;
  projectSlug?: string;
  sourcePackageRegistries?: ModuleProps['sourcePackageRegistries'];
}

// Configuration Start
const platformOptions: Record<PlaformOptionKey, PlatformOption> = {
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
};

const introduction = (
  <p>
    {tct(
      "Sentry's integration with Spring supports Spring Framework 5.1.2 and above. If you're on an older version, use [legacyIntegrationLink:our legacy integration].",
      {
        legacyIntegrationLink: (
          <ExternalLink href="https://docs.sentry.io/platforms/java/guides/spring/legacy/" />
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
  packageManager,
  springVersion,
}: StepsParams): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t(
      "Install Sentry's integration with Spring using %s:",
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
              description: t("Add the Sentry SDK to your project's dependencies."),
              language: 'xml',
              partialLoading: sourcePackageRegistries?.isLoading,
              code:
                springVersion === SpringVersion.V5
                  ? `
  <dependency>
    <groupId>io.sentry</groupId>
    <artifactId>sentry-spring</artifactId>
    <version>${
      sourcePackageRegistries?.isLoading
        ? t('\u2026loading')
        : sourcePackageRegistries?.data?.['sentry.java.spring']?.version ?? '6.28.0'
    }</version>
  </dependency>`
                  : `
  <dependency>
    <groupId>io.sentry</groupId>
    <artifactId>sentry-spring-jakarta</artifactId>
    <version>${
      sourcePackageRegistries?.isLoading
        ? t('\u2026loading')
        : sourcePackageRegistries?.data?.['sentry.java.spring.jakarta']?.version ??
          '6.28.0'
    }</version>
  </dependency>`,
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
                  : sourcePackageRegistries?.data?.['sentry.java.mavenplugin']?.version ??
                    '0.0.4'
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
...`,
            },
          ]
        : []),
    ],
  },
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
                  {springVersion === SpringVersion.V5
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
                code: `
import io.sentry.spring${
                  springVersion === SpringVersion.V6 ? '.jakarta' : ''
                }.EnableSentry;

@EnableSentry(dsn = "${dsn}")
@Configuration
class SentryConfiguration {
}`,
              },
              {
                language: 'java',
                label: 'Kotlin',
                value: 'kotlin',
                code: `
import io.sentry.spring${
                  springVersion === SpringVersion.V6 ? '.jakarta' : ''
                }.EnableSentry
import org.springframework.core.Ordered

@EnableSentry(
  dsn = "${dsn}",
  exceptionResolverOrder = Ordered.LOWEST_PRECEDENCE
)`,
              },
            ],
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
  {
    title: t('Other build tools'),
    additionalInfo: (
      <p>
        {tct(
          'For other dependency managers see the [mavenRepositorySpringLink:central Maven repository].',
          {
            mavenRepositorySpringLink:
              springVersion === SpringVersion.V5 ? (
                <ExternalLink
                  href={`https://central.sonatype.com/artifact/io.sentry/sentry-spring/${
                    sourcePackageRegistries?.data?.['sentry.java.spring']?.version ??
                    '6.28.0'
                  }`}
                />
              ) : (
                <ExternalLink
                  href={`https://central.sonatype.com/artifact/io.sentry/sentry-spring-jakarta/${
                    sourcePackageRegistries?.data?.['sentry.java.spring.jakarta']
                      ?.version ?? '6.28.0'
                  }`}
                />
              ),
          }
        )}
      </p>
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
    link: 'https://docs.sentry.io/platforms/java/guides/spring/performance/',
  },
];
// Configuration End

export function GettingStartedWithSpring({
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
        springVersion: optionValues.springVersion as SpringVersion,
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

export default GettingStartedWithSpring;
