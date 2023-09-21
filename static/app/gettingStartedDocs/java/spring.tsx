import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

interface StepsParams {
  dsn: string;
  organizationSlug?: string;
  projectSlug?: string;
  sourcePackageRegistries?: ModuleProps['sourcePackageRegistries'];
}

// Configuration Start
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
}: StepsParams): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t(
      "Install Sentry's integration with Spring using either Maven or Gradle:"
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
        code: `
SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___
            `,
      },
      {
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
              "There are two variants of Sentry available for Spring. If you're using Spring 5, use [sentrySpringLink:sentry-spring]. If you're using Spring 6, use [sentrySpringJakartaLink:sentry-spring-jakarta] instead.",
              {
                sentrySpringLink: (
                  <ExternalLink href="https://github.com/getsentry/sentry-java/tree/master/sentry-spring" />
                ),
                sentrySpringJakartaLink: (
                  <ExternalLink href="https://github.com/getsentry/sentry-java/tree/master/sentry-spring-jakarta" />
                ),
              }
            )}
          </p>
        ),
        configurations: [
          {
            language: 'xml',
            partialLoading: sourcePackageRegistries?.isLoading,
            description: <strong>{t('Spring 5')}</strong>,
            code: `
<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry-spring</artifactId>
  <version>${
    sourcePackageRegistries?.isLoading
      ? t('\u2026loading')
      : sourcePackageRegistries?.data?.['sentry.java.spring']?.version ?? '6.28.0'
  }</version>
</dependency>
          `,
          },
          {
            language: 'xml',
            partialLoading: sourcePackageRegistries?.isLoading,
            description: <strong>{t('Spring 6')}</strong>,
            code: `
<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry-spring-jakarta</artifactId>
  <version>${
    sourcePackageRegistries?.isLoading
      ? t('\u2026loading')
      : sourcePackageRegistries?.data?.['sentry.java.spring.jakarta']?.version ?? '6.28.0'
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
      <Fragment>
        {t("Configure Sentry as soon as possible in your application's lifecycle:")}
        <p>
          {tct(
            'The [codeSentrySpring:sentry-spring] and [codeSentrySpringJakarta:sentry-spring-jakarta] libraries provide an [codeEnableSentry:@EnableSentry] annotation that registers all required Spring beans. [codeEnableSentry:@EnableSentry] can be placed on any class annotated with [configurationLink:@Configuration] including the main entry class in Spring Boot applications annotated with [springBootApplicationLink:@SpringBootApplication].',
            {
              codeSentrySpring: <code />,
              codeSentrySpringJakarta: <code />,
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
            description: <strong>{t('Spring 5')}</strong>,
            code: `
import io.sentry.spring.EnableSentry;

@EnableSentry(dsn = "${dsn}")
@Configuration
class SentryConfiguration {
}
          `,
          },
          {
            language: 'java',
            description: <strong>{t('Spring 6')}</strong>,
            code: `
import io.sentry.spring.jakarta.EnableSentry;

@EnableSentry(dsn = "${dsn}")
@Configuration
class SentryConfiguration {
}
        `,
          },
        ],
      },
      {
        description: <h5>{t('Kotlin')}</h5>,
        configurations: [
          {
            language: 'java',
            description: <strong>{t('Spring 5')}</strong>,
            code: `
import io.sentry.spring.EnableSentry
import org.springframework.core.Ordered

@EnableSentry(
  dsn = "${dsn}",
  exceptionResolverOrder = Ordered.LOWEST_PRECEDENCE
)
          `,
          },
          {
            language: 'java',
            description: <strong>{t('Spring 6')}</strong>,
            code: `
import io.sentry.spring.jakarta.EnableSentry
import org.springframework.core.Ordered

@EnableSentry(
  dsn = "${dsn}",
  exceptionResolverOrder = Ordered.LOWEST_PRECEDENCE
)
        `,
          },
        ],
      },
      {
        description: <h5>{t('Source Context')}</h5>,
        configurations: [
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
        description: <h5>Java</h5>,
        language: 'java',
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
        language: 'java',
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
  {
    title: t('Other build tools'),
    additionalInfo: (
      <p>
        {tct(
          'For other dependency managers see the [mavenRepositorySpring5Link:central Maven repository (Spring 5)] and [mavenRepositorySpring6Link:central Maven repository (Spring 6)].',
          {
            mavenRepositorySpring5Link: (
              <ExternalLink
                href={`https://central.sonatype.com/artifact/io.sentry/sentry-spring/${
                  sourcePackageRegistries?.data?.['sentry.java.spring']?.version ??
                  '6.28.0'
                }`}
              />
            ),
            mavenRepositorySpring6Link: (
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

export default GettingStartedWithSpring;
