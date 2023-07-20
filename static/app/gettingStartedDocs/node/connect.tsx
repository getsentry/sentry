import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
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
  ...props
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
    description: <p>{tct('Configure Sentry as a middleware:', {code: <code />})}</p>,
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
      {
        language: 'javascript',
        description: (
          <p>
            {tct(
              '[code:requestHandler] accepts some options that let you decide what data should be included in the event sent to Sentry. Possible options are:',
              {code: <code />}
            )}
          </p>
        ),
        code: `
// keys to be extracted from req
request?: boolean | string[]; // default: true = ['cookies', 'data', 'headers', 'method', 'query_string', 'url']

// server name
serverName?: boolean; // default: true

// generate transaction name
//   path == request.path (eg. "/foo")
//   methodPath == request.method + request.path (eg. "GET|/foo")
//   handler == function name (eg. "fooHandler")
transaction?: boolean | 'path' | 'methodPath' | 'handler'; // default: true = 'methodPath'

// keys to be extracted from req.user
user?: boolean | string[]; // default: true = ['id', 'username', 'email']

// client ip address
ip?: boolean; // default: false

// node version
version?: boolean; // default: true

// timeout for fatal route errors to be delivered
flushTimeout?: number; // default: 2000
    `,
      },
      {
        language: 'javascript',
        description: (
          <p>
            {tct(
              'For example, if you want to skip the server name and add just user, you would use [code:requestHandler] like this:',
              {code: <code />}
            )}
          </p>
        ),
        code: `
app.use(
  Sentry.Handlers.requestHandler({
    serverName: false,
    user: ["email"],
  })
);
    `,
      },
      {
        language: 'javascript',
        description: (
          <p>
            {tct(
              'By default, [code:errorHandler] will capture only errors with a status code of [code:500] or higher. If you want to change it, provide it with the [code:shouldHandleError] callback, which accepts middleware errors as its argument and decides, whether an error should be sent or not, by returning an appropriate boolean value.',
              {code: <code />}
            )}
          </p>
        ),
        code: `
        app.use(
          Sentry.Handlers.errorHandler({
            shouldHandleError(error) {
              // Capture all 404 and 500 errors
              if (error.status === 404 || error.status === 500) {
                return true;
              }
              return false;
            },
          })
        );
    `,
      },
    ],
  },
  getUploadSourceMapsStep({
    guideLink: 'https://docs.sentry.io/platforms/node/guides/connect/sourcemaps/',
    ...props,
  }),
];

export function GettingStartedWithConnect({
  dsn,
  organization,
  newOrg,
  platformKey,
  projectId,
}: ModuleProps) {
  const sentryInitContent: string[] = [`dsn: "${dsn}"`];

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
        organization,
        newOrg,
        platformKey,
        projectId,
      })}
      newOrg={newOrg}
      platformKey={platformKey}
    />
  );
}

export default GettingStartedWithConnect;
