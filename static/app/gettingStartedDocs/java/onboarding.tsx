import {ExternalLink, Link} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

import {
  getGradleInstallSnippet,
  getMavenInstallSnippet,
  getOpenTelemetryRunSnippet,
  getVerifyJavaSnippet,
  PackageManager,
  packageManagerName,
  YesNo,
  type Params,
  type PlatformOptions,
} from './utils';

const getSentryPropertiesSnippet = (params: Params) => `
dsn=${params.dsn.public}
# Add data like request headers and IP for users,
# see https://docs.sentry.io/platforms/java/data-management/data-collected/ for more info
send-default-pii=true${
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
    params.isLogsSelected
      ? `

  // Enable sending logs to Sentry
  options.getLogs().setEnabled(true);`
      : ''
  }${
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

export const onboarding: OnboardingConfig<PlatformOptions> = {
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
          type: 'conditional',
          condition: params.platformOptions.packageManager === PackageManager.SBT,
          content: [
            {
              type: 'text',
              text: tct('Add the sentry SDK to your [code:libraryDependencies]:', {
                code: <code />,
              }),
            },
            {
              type: 'code',
              language: 'scala',
              code: `libraryDependencies += "io.sentry" % "sentry" % "${getPackageVersion(
                params,
                'sentry.java',
                '6.27.0'
              )}"`,
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
  configure: params => [
    params.platformOptions.opentelemetry === YesNo.YES
      ? {
          type: StepType.CONFIGURE,
          content: [
            {
              type: 'text',
              text: tct(
                "Here's the [code:sentry.properties] file that goes with the [code:java] command above:",
                {
                  code: <code />,
                }
              ),
            },
            {
              type: 'code',
              language: 'properties',
              code: getSentryPropertiesSnippet(params),
            },
          ],
        }
      : {
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
              language: 'java',
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
          language: 'java',
          code: getVerifyJavaSnippet(),
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
