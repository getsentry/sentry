import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

const performanceIntegrations: string[] = [
  `// enable HTTP calls tracing
new Sentry.Integrations.Http({ tracing: true }),`,
  `// enable Express.js middleware tracing
new Sentry.Integrations.Express({ app }),`,
];

const performanceOtherConfig = `// Performance Monitoring
tracesSampleRate: 1.0, // Capture 100% of the transactions, reduce in production!`;

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t('Add the Sentry Node SDK as a dependency:'),
    configurations: [
      {
        language: 'bash',
        code: `
# Using yarn
yarn add @sentry/node

# Using npm
npm install --save @sentry/node
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          "Initialize Sentry as early as possible in your application's lifecycle, for example in your [code:index.ts/js] entry point:",
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        import * as Sentry from "@sentry/node";
        import express from "express";

        // or using CommonJS
        // const Sentry = require('@sentry/node');
        // const express = require('express');

        const app = express();

        Sentry.init({
          ${sentryInitContent},
        });

        // Trace incoming requests
        app.use(Sentry.Handlers.requestHandler());
        app.use(Sentry.Handlers.tracingHandler());

        // All your controllers should live here
        app.get("/", function rootHandler(req, res) {
          res.end("Hello world!");
        });

        // The error handler must be registered before any other error middleware and after all controllers
        app.use(Sentry.Handlers.errorHandler());

        // Optional fallthrough error handler
        app.use(function onError(err, req, res, next) {
          // The error id is attached to \`res.sentry\` to be returned
          // and optionally displayed to the user for support.
          res.statusCode = 500;
          res.end(res.sentry + "\\n");
        });

        app.listen(3000);
        `,
      },
    ],
  },
  getUploadSourceMapsStep(
    'https://docs.sentry.io/platforms/node/guides/express/sourcemaps/'
  ),
  {
    type: StepType.VERIFY,
    description: t(
      "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        app.get("/debug-sentry", function mainHandler(req, res) {
          throw new Error("My first Sentry error!");
        });
        `,
      },
    ],
  },
];

export const nextSteps = [];

export function GettingStartedWithExpress({dsn, ...props}: ModuleProps) {
  let sentryInitContent: string[] = [`dsn: "${dsn}",`];

  const integrations = [...performanceIntegrations];
  const otherConfigs = [performanceOtherConfig];

  if (integrations.length > 0) {
    sentryInitContent = sentryInitContent.concat('integrations: [', integrations, '],');
  }

  if (otherConfigs.length > 0) {
    sentryInitContent = sentryInitContent.concat(otherConfigs);
  }

  return (
    <Layout
      steps={steps({sentryInitContent: sentryInitContent.join('\n')})}
      nextSteps={nextSteps}
      {...props}
    />
  );
}

export default GettingStartedWithExpress;
