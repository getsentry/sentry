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
  SBT = 'sbt',
}

export enum YesNo {
  YES = 'yes',
  NO = 'no',
}

const packageManagerName: Record<PackageManager, string> = {
  [PackageManager.GRADLE]: 'Gradle',
  [PackageManager.MAVEN]: 'Maven',
  [PackageManager.SBT]: 'SBT',
};

const platformOptions = {
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
  opentelemetry: {
    label: t('OpenTelemetry'),
    items: [
      {
        label: t('With OpenTelemetry'),
        value: YesNo.YES,
      },
      {
        label: t('Without OpenTelemetry'),
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
SENTRY_PROPERTIES_FILE=sentry.properties java -javaagent:sentry-opentelemetry-agent-${getPackageVersion(params, 'sentry.java.opentelemetry-agent', '8.0.0')}.jar -jar your-application.jar
`;

const getSentryPropertiesSnippet = (params: Params) => `
dsn=${params.dsn.public}
# Add data like request headers and IP for users,
# see https://docs.sentry.io/platforms/java/data-management/data-collected/ for more info
send-defaut-pii=true${
  params.isPerformanceSelected
    ? `
traces-sample-rate=1.0`
    : ''
}`;

const getConfigureSnippet = (params: Params) => `
import io.sentry.Sentry;

Sentry.init(options -> {
  options.setDsn("${params.dsn.public}");

  // Add data like request headers and IP for users,
  // see https://docs.sentry.io/platforms/java/data-management/data-collected/ for more info
  options.setSendDefaultPii(true);${
    params.isPerformanceSelected
      ? `
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  // We recommend adjusting this value in production.
  options.setTracesSampleRate(1.0);`
      : ''
  }
  // When first trying Sentry it's good to see what the SDK is doing:
  options.setDebug(true);
});`;

const getVerifySnippet = () => `
import java.lang.Exception;
import io.sentry.Sentry;

try {
  throw new Exception("This is a test.");
} catch (Exception e) {
  Sentry.captureException(e);
}`;

const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    tct(
      'Sentry for Java is a collection of modules provided by Sentry; it supports Java 1.8 and above. At its core, Sentry for Java provides a raw client for sending events to Sentry. If you use [strong:Spring Boot, Spring, Logback, or Log4j2], we recommend visiting our Sentry Java documentation for installation instructions.',
      {
        strong: <strong />,
        link: <ExternalLink href="https://docs.sentry.io/platforms/java/" />,
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
                partialLoading: params.sourcePackageRegistries?.isLoading,
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
                partialLoading: params.sourcePackageRegistries?.isLoading,
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
        ...(params.platformOptions.packageManager === PackageManager.SBT
          ? [
              {
                description: tct(
                  'Add the sentry SDK to your [code:libraryDependencies]:',
                  {
                    code: <code />,
                  }
                ),
                language: 'scala',
                partialLoading: params.sourcePackageRegistries?.isLoading,
                code: `libraryDependencies += "io.sentry" % "sentry" % "${getPackageVersion(
                  params,
                  'sentry.java',
                  '6.27.0'
                )}"`,
              },
            ]
          : []),
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
    params.platformOptions.opentelemetry === YesNo.YES
      ? {
          type: StepType.CONFIGURE,
          description: tct(
            "Here's the [code:sentry.properties] file that goes with the [code:java] command above:",
            {
              code: <code />,
            }
          ),
          configurations: [
            {
              language: 'java',
              code: getSentryPropertiesSnippet(params),
            },
          ],
        }
      : {
          type: StepType.CONFIGURE,
          description: t(
            "Configure Sentry as soon as possible in your application's lifecycle:"
          ),
          configurations: [
            {
              language: 'java',
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
          language: 'java',
          code: getVerifySnippet(),
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

export const feedbackOnboardingCrashApiJava: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      description: getCrashReportInstallDescription(),
      configurations: [
        {
          code: [
            {
              label: 'Java',
              value: 'java',
              language: 'java',
              code: `import io.sentry.Sentry;
import io.sentry.UserFeedback;

SentryId sentryId = Sentry.captureMessage("My message");

UserFeedback userFeedback = new UserFeedback(sentryId);
userFeedback.setComments("It broke.");
userFeedback.setEmail("john.doe@example.com");
userFeedback.setName("John Doe");
Sentry.captureUserFeedback(userFeedback);`,
            },
            {
              label: 'Kotlin',
              value: 'kotlin',
              language: 'kotlin',
              code: `import io.sentry.Sentry
import io.sentry.UserFeedback

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
  feedbackOnboardingCrashApi: feedbackOnboardingCrashApiJava,
  crashReportOnboarding: feedbackOnboardingCrashApiJava,
  onboarding,
};

export default docs;
