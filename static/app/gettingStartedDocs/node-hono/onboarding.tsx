import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getImportInstrumentSnippet,
  getInstallCodeBlock,
  getSdkInitSnippet,
  getSentryImportSnippet,
} from 'sentry/gettingStartedDocs/node/utils';
import {t, tct} from 'sentry/locale';

const getVerifySnippet = (params: DocsParams) => `app.get("/debug-sentry", () => {${
  params.isLogsSelected
    ? `
  // Send a log before throwing the error
  Sentry.logger.info('User triggered test error', {
    action: 'test_error_endpoint',
  });`
    : ''
}${
  params.isMetricsSelected
    ? `
  // Send a test metric before throwing the error
  Sentry.metrics.count('test_counter', 1);`
    : ''
}
  throw new Error("My first Sentry error!");
});`;

const getSdkSetupSnippet = () => `
${getImportInstrumentSnippet()}

// All other imports below
${getSentryImportSnippet('@sentry/node')}
const { Hono } = require("hono");
const { HTTPException } = require("hono/http-exception");


const app = new Hono()
  // Add an onError hook to report unhandled exceptions to Sentry.
  .onError((err, c) => {
    // Report _all_ unhandled errors.
    Sentry.captureException(err);
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    // Or just report errors which are not instances of HTTPException
    // Sentry.captureException(err);
    return c.json({ error: "Internal server error" }, 500);
  })
  // Optional: Bind global context via Hono middleware
  // Note: This requires session middleware to be configured
  .use((c, next) => {
    // Only set user context if session exists and has user data
    if (c.session?.user?.email) {
      Sentry.setUser({
        email: c.session.user.email,
      });
    }

    // Only set project tag if session has project data
    if (c.session?.projectId !== undefined && c.session?.projectId !== null) {
      Sentry.setTag("project_id", c.session.projectId);
    }

    return next();
  })
  // Your routes...
  .get("/", () => {
    // ...
  });
`;

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'alert',
          alertType: 'info',
          showIcon: false,
          text: tct(
            "This guide assumes you're using the Node.js runtime for Hono. For setup instructions on Cloudflare Workers, see our [honoCloudFlareLink:Hono on Cloudflare guide].",
            {
              honoCloudFlareLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/hono/" />
              ),
            }
          ),
        },
        {
          type: 'text',
          text: t('Add the Sentry Node SDK as a dependency:'),
        },
        getInstallCodeBlock(params),
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
            "Initialize Sentry as early as possible in your application's lifecycle."
          ),
        },
        {
          type: 'text',
          text: tct(
            'To initialize the SDK before everything else, create an external file called [code:instrument.js/mjs].',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'instrument.(js|mjs)',
              value: 'javascript',
              code: getSdkInitSnippet(params, 'node'),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            "Make sure to import [code:instrument.js/mjs] at the top of your file. Set up the error handler. This setup is typically done in your application's entry point file, which is usually [code:index.(js|ts)]. If you're running your application in ESM mode, or looking for alternative ways to set up Sentry, read about [docs:installation methods in our docs].",
            {
              code: <code />,
              docs: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/hono/install/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'index.(js|mjs)',
              value: 'javascript',
              code: getSdkSetupSnippet(),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/hono/sourcemaps/',
      ...params,
    }),
  ],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Add the following code snippet to your main application file, adding a route that triggers an error that Sentry will capture.'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getVerifySnippet(params),
            },
          ],
        },
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
    const steps = [];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/hono/logs/#integrations',
      });
    }

    return steps;
  },
};
