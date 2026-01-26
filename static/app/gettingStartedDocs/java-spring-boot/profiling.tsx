import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {profiling as profilingBase} from 'sentry/gettingStartedDocs/java/profiling';
import {t, tct} from 'sentry/locale';
import {getProfilingDocsForPlatform} from 'sentry/utils/profiling/platforms';

export const getProfilingSpringPropertiesSnippet = () => `
# Set profile-session-sample-rate to 1.0 to profile 100% of profile sessions.
sentry.profile-session-sample-rate=1.0
# Set profile-lifecycle to trace to automatically start and stop
# profiling when a transaction starts and finishes.
sentry.profile-lifecycle=TRACE`;

export const getProfilingSpringYamlSnippet = () => `
  # Set profile-session-sample-rate to 1.0 to profile 100% of profile sessions.
  profile-session-sample-rate: 1.0
  # Set profile-lifecycle to trace to automatically start and stop
  # profiling when a transaction starts and finishes.
  profile-lifecycle: TRACE`;

const getConfigurationPropertiesSnippet = (params: DocsParams) => `
sentry.dsn=${params.dsn.public}
sentry.traces-sample-rate=1.0
${getProfilingSpringPropertiesSnippet()}`;

const getConfigurationYamlSnippet = (params: DocsParams) => `
sentry:
  dsn: ${params.dsn.public}
  traces-sample-rate: 1.0
${getProfilingSpringYamlSnippet()}`;

export const profiling: OnboardingConfig = {
  introduction: (params: DocsParams) =>
    tct(
      'Sentry profiling for Spring Boot allows you to collect and analyze performance profiles of your application to identify and optimize slow code paths. To learn more about profiling, see our [link:Profiling documentation].',
      {
        link: (
          <ExternalLink
            href={`${getProfilingDocsForPlatform(params.project.platform)}`}
          />
        ),
      }
    ),
  install: params => profilingBase.install(params),
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable profiling, add the [code:profile-session-sample-rate] option to your [code:application.properties] or [code:application.yml]:',
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
              language: 'yaml',
              code: getConfigurationYamlSnippet(params),
            },
          ],
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
            'For more detailed information on profiling, see the [link:Spring Boot profiling documentation].',
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
