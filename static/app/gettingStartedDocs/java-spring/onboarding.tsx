import {ExternalLink, Link} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getGradleInstallSnippet,
  getVerifyJavaSnippet,
  getVerifyKotlinSnippet,
  PackageManager,
  YesNo,
} from 'sentry/gettingStartedDocs/java/utils';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

import {SpringVersion, type Params, type PlatformOptions} from './utils';

const getMavenInstallSnippet = (params: Params) => `
<build>
  <plugins>
    <plugin>
      <groupId>io.sentry</groupId>
      <artifactId>sentry-maven-plugin</artifactId>
      <version>${
        params.sourcePackageRegistries?.isLoading
          ? t('\u2026loading')
          : (params.sourcePackageRegistries?.data?.['sentry.java.maven-plugin']
              ?.version ?? '0.0.4')
      }</version>
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

const getOpenTelemetryRunSnippet = (params: Params) => `
SENTRY_AUTO_INIT=false java -javaagent:sentry-opentelemetry-agent-${getPackageVersion(params, 'sentry.java.opentelemetry-agent', '8.0.0')}.jar -jar your-application.jar
`;

const getOpenTelemetryApplicationServerSnippet = (params: Params) => `
JAVA_OPTS="$\{JAVA_OPTS} -javaagent:/somewhere/sentry-opentelemetry-agent-${getPackageVersion(params, 'sentry.java.opentelemetry-agent', '8.0.0')}.jar"
`;

const getJavaConfigSnippet = (params: Params) => `
import io.sentry.spring${
  params.platformOptions.springVersion === SpringVersion.V6
    ? '.jakarta'
    : params.platformOptions.springVersion === SpringVersion.V7
      ? '7'
      : ''
}.EnableSentry;

@EnableSentry(
  dsn = "${params.dsn.public}",
  // Add data like request headers and IP for users,
  // see https://docs.sentry.io/platforms/java/guides/spring/data-management/data-collected/ for more info
  sendDefaultPii = true
)
@Configuration
class SentryConfiguration {
}`;

const getKotlinConfigSnippet = (params: Params) => `
import io.sentry.spring${
  params.platformOptions.springVersion === SpringVersion.V6
    ? '.jakarta'
    : params.platformOptions.springVersion === SpringVersion.V7
      ? '7'
      : ''
}.EnableSentry
import org.springframework.core.Ordered

@EnableSentry(
  dsn = "${params.dsn.public}",
  // Add data like request headers and IP for users,
  // see https://docs.sentry.io/platforms/java/guides/spring/data-management/data-collected/ for more info
  sendDefaultPii = true,
  exceptionResolverOrder = Ordered.LOWEST_PRECEDENCE
)`;

const getSentryPropertiesSnippet = (params: Params) =>
  `${
    params.isLogsSelected
      ? `
# Enable sending logs to Sentry
logs.enabled=true`
      : ''
  }${
    params.isPerformanceSelected
      ? `
# Set traces-sample-rate to 1.0 to capture 100% of transactions for tracing.
# We recommend adjusting this value in production.
traces-sample-rate=1.0`
      : ''
  }`;

export const onboarding: OnboardingConfig<PlatformOptions> = {
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
      content: [
        {
          type: 'text',
          text: t(
            "Install Sentry's integration with Spring using %s:",
            params.platformOptions.packageManager === PackageManager.GRADLE
              ? 'Gradle'
              : 'Maven'
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
          code: 'SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___',
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
                "When running your application, please add our [code:sentry-opentelemetry-agent] to the [code:java] command. In case you are using an application server to run your [code:.WAR] file, please add it to the [code:JAVA_OPTS] of your application server. You can download the latest version of the [code:sentry-opentelemetry-agent.jar] from [linkMC:MavenCentral]. It's also available as a [code:ZIP] containing the [code:JAR] used on this page on [linkGH:GitHub].",
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
            {
              type: 'text',
              text: t(
                'In case of an application server, adding the Agent might look more like the following:'
              ),
            },
            {
              type: 'code',
              language: 'bash',
              code: getOpenTelemetryApplicationServerSnippet(params),
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
          text: [
            t("Configure Sentry as soon as possible in your application's lifecycle."),
            tct(
              'The [libraryName] library provides an [codeEnableSentry:@EnableSentry] annotation that registers all required Spring beans. [codeEnableSentry:@EnableSentry] can be placed on any class annotated with [configurationLink:@Configuration] including the main entry class in Spring Boot applications annotated with [springBootApplicationLink:@SpringBootApplication].',
              {
                libraryName: (
                  <code>
                    {params.platformOptions.springVersion === SpringVersion.V5
                      ? 'sentry-spring'
                      : params.platformOptions.springVersion === SpringVersion.V6
                        ? 'sentry-spring-jakarta'
                        : 'sentry-spring-7'}
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
            ),
          ],
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Java',
              language: 'java',
              code: getJavaConfigSnippet(params),
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              code: getKotlinConfigSnippet(params),
            },
          ],
        },
        {
          type: 'conditional',
          condition: params.isPerformanceSelected || params.isLogsSelected,
          content: [
            {
              type: 'text',
              text: tct(
                'Add a [code:sentry.properties] file to enable additional features:',
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
            'Last, create an intentional error, so you can test that everything is working:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Java',
              language: 'java',
              code: getVerifyJavaSnippet(),
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
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
