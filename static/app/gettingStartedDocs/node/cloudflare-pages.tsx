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

const getSdkConfigureSnippetToml = () => `
compatibility_flags = ["nodejs_compat"]
# compatibility_flags = ["nodejs_als"]
compatibility_date = "2024-09-23"
`;

const getSdkConfigureSnippetJson = () => `
{
  "compatibility_flags": [
    "nodejs_compat"
  ],
  "compatibility_date": "2024-09-23"
}`;

const getSdkSetupSnippet = (params: Params) => `
import * as Sentry from "@sentry/cloudflare";

export const onRequest = [
  // Make sure Sentry is the first middleware
  Sentry.sentryPagesPlugin((context) => ({
    dsn: "${params.dsn.public}",
    // Set tracesSampleRate to 1.0 to capture 100% of spans for tracing.
    // Learn more at
    // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
    tracesSampleRate: 1.0,
  })),
  // Add more middlewares here
];`;

const getVerifySnippet = () => `
export function onRequest(context) {
  throw new Error();
}`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct(
      "In this quick guide, you'll set up and configure the Sentry Cloudflare SDK for use in your Cloudflare Pages application. This will enable Sentry for the backend part of your application: the functions. If you'd like to monitor the frontend as well, refer to the instrumentation guide for [platformLink:the framework of your choice].",
      {
        platformLink: <ExternalLink href="https://docs.sentry.io/platforms/" />,
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
              label: 'JSON',
              value: 'json',
              language: 'json',
              filename: 'wrangler.json',
              code: getSdkConfigureSnippetJson(),
            },
            {
              label: 'Toml',
              value: 'toml',
              language: 'toml',
              filename: 'wrangler.toml',
              code: getSdkConfigureSnippetToml(),
            },
          ],
        },
        {
          description: tct(
            'Add the [code:sentryPagesPlugin] as [guideLink:middleware to your Cloudflare Pages application]. We recommend adding a [code:functions/_middleware.js] for the middleware setup so that Sentry is initialized for your entire app.',
            {
              code: <code />,
              guideLink: (
                <ExternalLink href="https://developers.cloudflare.com/pages/functions/middleware/" />
              ),
            }
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'functions/_middleware.js',
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
      description: tct(
        "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected. To trigger it, you need to access the [code:/customerror] path on your deployment.",
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          label: 'JavaScript',
          value: 'javascript',
          language: 'javascript',
          filename: 'functions/customerror.js',
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
