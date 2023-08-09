import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types';

type StepProps = {
  newOrg: boolean;
  organization: Organization;
  platformKey: PlatformKey;
  projectId: string;
  sentryInitContent: string;
};

export const steps = ({
  sentryInitContent,
}: Partial<StepProps> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>{tct('Add [code:@sentry/node] as a dependency:', {code: <code />})}</p>
    ),
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
    description: t('Configure Sentry as a middleware:'),
    configurations: [
      {
        language: 'javascript',
        code: `
        import * as Sentry from "@sentry/node";
        import connect from "connect";

        // or using CommonJS
        // const connect = require('connect');
        // const Sentry = require('@sentry/node');

        // Configure Sentry before doing anything else
        Sentry.init({
          ${sentryInitContent},
        });

        function mainHandler(req, res) {
          throw new Error("My first Sentry error!");
        }

        function onError(err, req, res, next) {
          // The error id is attached to \`res.sentry\` to be returned
          // and optionally displayed to the user for support.
          res.statusCode = 500;
          res.end(res.sentry + "\\n");
        }

        connect(
          // The request handler be the first item
          Sentry.Handlers.requestHandler(),

          connect.bodyParser(),
          connect.cookieParser(),
          mainHandler,

          // The error handler must be before any other error middleware
          Sentry.Handlers.errorHandler(),

          // Optional fallthrough error handler
          onError
        ).listen(3000);
        `,
      },
    ],
  },
];

export function GettingStartedWithConnect({dsn, newOrg, platformKey}: ModuleProps) {
  const sentryInitContent: string[] = [`dsn: "${dsn}"`];

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
      })}
      newOrg={newOrg}
      platformKey={platformKey}
    />
  );
}

export default GettingStartedWithConnect;
