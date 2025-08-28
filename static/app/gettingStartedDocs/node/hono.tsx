import {ExternalLink} from 'sentry/components/core/link';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {
  getImportInstrumentSnippet,
  getInstallConfig,
  getNodeAgentMonitoringOnboarding,
  getNodeLogsOnboarding,
  getNodeMcpOnboarding,
  getNodeProfilingOnboarding,
  getSdkInitSnippet,
  getSentryImportSnippet,
} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getVerifySnippet = (params: Params) => `app.get("/debug-sentry", () => {${
  params.isLogsSelected
    ? `
  // Send a log before throwing the error
  Sentry.logger.info('User triggered test error', {
    action: 'test_error_endpoint',
  });`
    : ''
}
  throw new Error("My first Sentry error!");
});`;

const getSdkSetupSnippet = () => `
${getImportInstrumentSnippet()}

// All other imports below
${getSentryImportSnippet('node')}
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

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Add the Sentry Node SDK as a dependency:'),
        },
        {
          type: 'code',
          tabs: getInstallConfig(params)[0]!.code,
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
  verify: (params: Params) => [
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
  nextSteps: (params: Params) => {
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

const feedbackOnboardingNode: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: getCrashReportInstallDescription(),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: `import * as Sentry from "@sentry/node";

const eventId = Sentry.captureMessage("User Feedback");
// OR: const eventId = Sentry.lastEventId();

const userFeedback = {
  event_id: eventId,
  name: "John Doe",
  email: "john@doe.com",
  comments: "I really like your App, thanks!",
};
Sentry.captureUserFeedback(userFeedback);
`,
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

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/hono/user-feedback/configuration/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboardingNode,
  crashReportOnboarding,
  logsOnboarding: getNodeLogsOnboarding({
    docsPlatform: 'hono',
    sdkPackage: '@sentry/node',
  }),
  profilingOnboarding: getNodeProfilingOnboarding(),
  agentMonitoringOnboarding: getNodeAgentMonitoringOnboarding(),
  mcpOnboarding: getNodeMcpOnboarding(),
};

export default docs;
