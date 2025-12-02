import {ExternalLink, Link} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getGradleInstallSnippet,
  getMavenInstallSnippet,
  getVerifyJavaSnippet,
  getVerifyKotlinSnippet,
  PackageManager,
  YesNo,
} from 'sentry/gettingStartedDocs/java/utils';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

import type {Params, PlatformOptions} from './utils';

const getOpenTelemetryRunSnippet = (params: Params) => `
SENTRY_AUTO_INIT=false java -javaagent:sentry-opentelemetry-agent-${getPackageVersion(params, 'sentry.java.opentelemetry-agent', '8.0.0')}.jar -jar your-application.jar
`;

const getConfigurationPropertiesSnippet = (params: Params) => `
sentry.dsn=${params.dsn.public}
# Add data like request headers and IP for users,
# see https://docs.sentry.io/platforms/java/guides/spring-boot/data-management/data-collected/ for more info
sentry.send-default-pii=true${
  params.isLogsSelected
    ? `
# Enable sending logs to Sentry
sentry.logs.enabled=true`
    : ''
}${
  params.isPerformanceSelected
    ? `
# Set traces-sample-rate to 1.0 to capture 100% of transactions for tracing.
# We recommend adjusting this value in production.
sentry.traces-sample-rate=1.0`
    : ''
}`;

const getConfigurationYamlSnippet = (params: Params) => `
sentry:
  dsn: ${params.dsn.public}
  # Add data like request headers and IP for users,
  # see https://docs.sentry.io/platforms/java/guides/spring-boot/data-management/data-collected/ for more info
  send-default-pii: true${
    params.isLogsSelected
      ? `
  # Enable sending logs to Sentry
  logs:
    enabled: true`
      : ''
  }${
    params.isPerformanceSelected
      ? `
  # Set traces-sample-rate to 1.0 to capture 100% of transactions for tracing.
  # We recommend adjusting this value in production.
  traces-sample-rate: 1.0`
      : ''
  }`;

export const onboarding: OnboardingConfig<PlatformOptions> = {
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
      content: [
        {
          type: 'text',
          text: tct(
            'To see source context in Sentry, you have to generate an auth token by visiting the [link:Organization Tokens] settings. You can then set the token as an environment variable that is used by the build plugins.',
            {
              link: <Link to="/settings/auth-tokens/" />,
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
          type: 'conditional',
          condition: params.platformOptions.opentelemetry === YesNo.YES,
          content: [
            {
              type: 'text',
              text: tct(
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
            },
            {
              type: 'code',
              language: 'bash',
              code: getOpenTelemetryRunSnippet(params),
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
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Open up [code:src/main/application.properties] (or [code:src/main/application.yml]) and configure the DSN, and any other settings you need:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Properties',
              language: 'properties',
              code: getConfigurationPropertiesSnippet(params),
            },
            {
              label: 'YAML',
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
      content: [
        {
          type: 'text',
          text: t(
            'Then create an intentional error, so you can test that everything is working using either Java or Kotlin:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Java',
              language: 'javascript',
              code: getVerifyJavaSnippet(),
            },
            {
              label: 'Kotlin',
              language: 'javascript',
              code: getVerifyKotlinSnippet(),
            },
          ],
        },
        {
          type: 'text',
          text: t(
            "If you're new to Sentry, use the email alert to access your account and complete a product tour."
          ),
        },
        {
          type: 'text',
          text: t(
            "If you're an existing user and have disabled alerts, you won't receive this email."
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
  ],
};
