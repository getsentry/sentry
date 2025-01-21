import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {getInstallConfig} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getSdkConfigureSnippet = () => `
compatibility_flags = ["nodejs_compat"]
# compatibility_flags = ["nodejs_als"]
`;

const getSdkSetupSnippet = (params: Params) => `
import {withSentry} from "@sentry/cloudflare";

export default withSentry(
  env => ({
    dsn: "${params.dsn.public}",
    // Set tracesSampleRate to 1.0 to capture 100% of spans for tracing.
    // Learn more at
    // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
    tracesSampleRate: 1.0,
  }),
  {
    async fetch(request, env, ctx) {
      return new Response('Hello World!');
    },
  } satisfies ExportedHandler<Env>,
);`;

const getVerifySnippet = () => `
setTimeout(() => {
  throw new Error();
});`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct(
      'In this quick guide you’ll use [strong:npm], [strong:yarn] or [strong:pnpm] to set up:',
      {
        strong: <strong />,
      }
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      description: t('Add the Sentry Cloudflare SDK as a dependency:'),
      configurations: getInstallConfig(params, {
        basePackage: '@sentry/cloudflare',
      }),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Configuration should happen as early as possible in your application's lifecycle."
      ),
      configurations: [
        {
          description: tct(
            "To use the SDK, you'll need to set either the [code:nodejs_compat] or [code:nodejs_als] compatibility flags in your [code:wrangler.toml]. This is because the SDK needs access to the [code:AsyncLocalStorage] API to work correctly.",
            {
              code: <code />,
            }
          ),
          code: [
            {
              label: 'Toml',
              value: 'toml',
              language: 'toml',
              filename: 'wrangler.toml',
              code: getSdkConfigureSnippet(),
            },
          ],
        },
        {
          description: tct(
            'To use this SDK, wrap your handler with the [code:withSentry] function. This will initialize the SDK and hook into the environment. Note that you can turn off almost all side effects using the respective options.',
            {
              code: <code />,
              guideLink: (
                <ExternalLink href="https://developers.cloudflare.com/pages/functions/middleware/" />
              ),
            }
          ),
          code: [
            {
              label: 'TypeScript',
              value: 'typescript',
              language: 'typescript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink:
        'https://docs.sentry.io/platforms/javascript/guides/cloudflare/sourcemaps/',
      ...params,
    }),
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
      ),
      configurations: [
        {
          language: 'javascript',
          code: getVerifySnippet(),
        },
      ],
    },
  ],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/cloudflare/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  crashReportOnboarding,
};

export default docs;
