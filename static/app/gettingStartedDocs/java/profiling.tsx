import {ExternalLink} from '@sentry/scraps/link';

import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';
import {getProfilingDocsForPlatform} from 'sentry/utils/profiling/platforms';

export const getGradleProfilingSnippet = (params: DocsParams) =>
  `implementation 'io.sentry:sentry-async-profiler:${getPackageVersion(params, 'sentry.java.async-profiler', '8.23.0')}'`;

export const getMavenProfilingSnippet = (params: DocsParams, wrapped: boolean) => {
  const inner = `<dependency>
  <groupId>io.sentry</groupId>
  <artifactId>sentry-async-profiler</artifactId>
  <version>${getPackageVersion(params, 'sentry.java.async-profiler', '8.23.0')}</version>
</dependency>`;

  return wrapped
    ? `<dependencies>
${inner}
</dependencies>`
    : inner;
};

export const getSbtProfilingSnippet = (params: DocsParams) =>
  `libraryDependencies += "io.sentry" % "sentry-async-profiler" % "${getPackageVersion(params, 'sentry.java.async-profiler', '8.23.0')}"`;

export const getProfilingSentryPropertiesSnippet = () => `
# Set profile-session-sample-rate to 1.0 to profile 100% of profile sessions.
profile-session-sample-rate=1.0
# Set profile-lifecycle to trace to automatically start and stop
# profiling when a transaction starts and finishes.
profile-lifecycle=trace`;

export const getJavaProfilingConfigSnippet = () => `
  // Set profileSessionSampleRate to 1.0 to profile 100% of profile sessions.
  options.setProfileSessionSampleRate(1.0);
  // Set profileLifecycle to TRACE to automatically start and stop
  // profiling when a transaction starts and finishes.
  options.setProfileLifecycle(ProfileLifecycle.TRACE);`;

export const getKotlinProfilingConfigSnippet = () => `
  // Set profileSessionSampleRate to 1.0 to profile 100% of profile sessions.
  options.profileSessionSampleRate = 1.0
  // Set profileLifecycle to TRACE to automatically start and stop
  // profiling when a transaction starts and finishes.
  options.profileLifecycle = ProfileLifecycle.TRACE`;

const getJavaConfigureSnippet = (params: DocsParams) => `
import io.sentry.Sentry;
import io.sentry.ProfileLifecycle;

Sentry.init(options -> {
  options.setDsn("${params.dsn.public}");${
    params.isPerformanceSelected
      ? `
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  // We recommend adjusting this value in production.
  options.setTracesSampleRate(1.0);`
      : ''
  }
${getJavaProfilingConfigSnippet()}
});`;

const getKotlinConfigureSnippet = (params: DocsParams) => `
import io.sentry.Sentry
import io.sentry.ProfileLifecycle

Sentry.init { options ->
  options.dsn = "${params.dsn.public}"${
    params.isPerformanceSelected
      ? `
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  // We recommend adjusting this value in production.
  options.tracesSampleRate = 1.0`
      : ''
  }
${getKotlinProfilingConfigSnippet()}
}`;

const getSentryPropertiesSnippet = (params: DocsParams) => `
dsn=${params.dsn.public}
traces-sample-rate=1.0${getProfilingSentryPropertiesSnippet()}`;

export const profiling: OnboardingConfig = {
  introduction: (params: DocsParams) =>
    tct(
      'Sentry profiling for Java allows you to collect and analyze performance profiles of your application to identify and optimize slow code paths. To learn more about profiling, see our [link:Profiling documentation].',
      {
        link: (
          <ExternalLink
            href={`${getProfilingDocsForPlatform(params.project.platform)}`}
          />
        ),
      }
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable profiling, you need to use Sentry Java SDK version [code:8.23.0] or higher.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Gradle',
              language: 'groovy',
              code: getGradleProfilingSnippet(params),
            },
            {
              label: 'Maven',
              language: 'xml',
              code: getMavenProfilingSnippet(params, false),
            },
            {
              label: 'SBT',
              language: 'scala',
              code: getSbtProfilingSnippet(params),
            },
          ],
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
            'To enable profiling, configure the Sentry SDK with the profileSessionSampleRate option:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Java',
              language: 'java',
              code: getJavaConfigureSnippet(params),
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              code: getKotlinConfigureSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Alternatively, you can configure profiling via [code:sentry.properties]:',
            {code: <code />}
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
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that profiling is working correctly by simply running your application. The SDK will automatically collect profiles for sampled transactions.'
          ),
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information on profiling, see the [link:Java profiling documentation].',
            {
              link: (
                <ExternalLink
                  href={`${getProfilingDocsForPlatform(params.project.platform)}`}
                />
              ),
            }
          ),
        },
      ],
    },
  ],
};
