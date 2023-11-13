import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {PlatformOption} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

export enum PackageManager {
  GRADLE = 'gradle',
  MAVEN = 'maven',
  SBT = 'sbt',
}

type PlaformOptionKey = 'packageManager';

interface StepsParams {
  dsn: string;
  hasPerformance: boolean;
  packageManager: PackageManager;
  organizationSlug?: string;
  projectSlug?: string;
  sourcePackageRegistries?: ModuleProps['sourcePackageRegistries'];
}

// Configuration Start
const packageManagerName: Record<PackageManager, string> = {
  [PackageManager.GRADLE]: 'Gradle',
  [PackageManager.MAVEN]: 'Maven',
  [PackageManager.SBT]: 'SBT',
};

const platformOptions: Record<PlaformOptionKey, PlatformOption> = {
  packageManager: {
    label: t('Package Manager'),
    items: [
      {
        label: packageManagerName[PackageManager.GRADLE],
        value: PackageManager.GRADLE,
      },
      {
        label: packageManagerName[PackageManager.MAVEN],
        value: PackageManager.MAVEN,
      },
      {
        label: packageManagerName[PackageManager.SBT],
        value: PackageManager.SBT,
      },
    ],
  },
};

const introduction = (
  <p>
    {tct(
      'Sentry for Java is a collection of modules provided by Sentry; it supports Java 1.8 and above. At its core, Sentry for Java provides a raw client for sending events to Sentry. If you use [strong:Spring Boot, Spring, Logback, or Log4j2], we recommend visiting our Sentry Java documentation for installation instructions.',
      {
        strong: <strong />,
        link: <ExternalLink href="https://docs.sentry.io/platforms/java/" />,
      }
    )}
  </p>
);

export const steps = ({
  dsn,
  sourcePackageRegistries,
  packageManager,
  projectSlug,
  hasPerformance,
  organizationSlug,
}: StepsParams): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t(`Install the SDK via %s:`, packageManagerName[packageManager]),
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
        code: `SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___`,
      },
      ...(packageManager === PackageManager.GRADLE
        ? [
            {
              language: 'groovy',
              partialLoading: sourcePackageRegistries?.isLoading,
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
              code: `<build>
  <plugins>
    <plugin>
      <groupId>io.sentry</groupId>
      <artifactId>sentry-maven-plugin</artifactId>
      <version>${
        sourcePackageRegistries?.isLoading
          ? t('\u2026loading')
          : sourcePackageRegistries?.data?.['sentry.java.maven-plugin']?.version ??
            '0.0.4'
      }</version>
      <extensions>true</extensions>
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
</build>`,
            },
          ]
        : []),
      ...(packageManager === PackageManager.SBT
        ? [
            {
              description: (
                <p>
                  {tct('Add the sentry SDK to your [code:libraryDependencies]:', {
                    code: <code />,
                  })}
                </p>
              ),
              language: 'scala',
              partialLoading: sourcePackageRegistries?.isLoading,
              code: `libraryDependencies += "io.sentry" % "sentry" % "${
                sourcePackageRegistries?.isLoading
                  ? t('\u2026loading')
                  : sourcePackageRegistries?.data?.['sentry.java']?.version ?? '6.27.0'
              }"`,
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
  {
    type: StepType.CONFIGURE,
    description: t(
      "Configure Sentry as soon as possible in your application's lifecycle:"
    ),
    configurations: [
      {
        language: 'java',
        code: `
import io.sentry.Sentry;

Sentry.init(options -> {
  options.setDsn("${dsn}");${
    hasPerformance
      ? `
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production.
  options.setTracesSampleRate(1.0);`
      : ''
  }
  // When first trying Sentry it's good to see what the SDK is doing:
  options.setDebug(true);
});
      `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: (
      <p>
        {tct(
          'Trigger your first event from your development environment by intentionally creating an error with the [code:Sentry#captureException] method, to test that everything is working:',
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
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
    link: 'https://docs.sentry.io/platforms/java/performance/',
  },
];
// Configuration End

export function GettingStartedWithJava({
  dsn,
  sourcePackageRegistries,
  projectSlug,
  organization,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const optionValues = useUrlPlatformOptions(platformOptions);

  const hasPerformance = activeProductSelection.includes(
    ProductSolution.PERFORMANCE_MONITORING
  );

  const nextStepDocs = [...nextSteps];

  return (
    <Layout
      steps={steps({
        dsn,
        sourcePackageRegistries,
        projectSlug: projectSlug ?? '___PROJECT_SLUG___',
        organizationSlug: organization?.slug ?? '___ORG_SLUG___',
        packageManager: optionValues.packageManager as PackageManager,
        hasPerformance,
      })}
      platformOptions={platformOptions}
      nextSteps={nextStepDocs}
      introduction={introduction}
      projectSlug={projectSlug}
      {...props}
    />
  );
}

export default GettingStartedWithJava;
