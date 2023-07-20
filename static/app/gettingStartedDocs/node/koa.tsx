import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

const performanceIntegrations: string[] = [
  `// Automatically instrument Node.js libraries and frameworks
  ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),`,
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
yarn add @sentry/node @sentry/utils

# Using npm
npm install --save @sentry/node @sentry/utils
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
        const Sentry = require("@sentry/node");
        const { stripUrlQueryAndFragment } = require("@sentry/utils");
        const Koa = require("koa");
        const app = new Koa();

        Sentry.init({
          ${sentryInitContent},
        });

        const requestHandler = (ctx, next) => {
          return new Promise((resolve, reject) => {
            Sentry.runWithAsyncContext(async () => {
              const hub = Sentry.getCurrentHub();
              hub.configureScope((scope) =>
                scope.addEventProcessor((event) =>
                  Sentry.addRequestDataToEvent(event, ctx.request, {
                    include: {
                      user: false,
                    },
                  })
                )
              );

              try {
                await next();
              } catch (err) {
                reject(err);
              }
              resolve();
            });
          });
        };

        // this tracing middleware creates a transaction per request
        const tracingMiddleWare = async (ctx, next) => {
          const reqMethod = (ctx.method || "").toUpperCase();
          const reqUrl = ctx.url && stripUrlQueryAndFragment(ctx.url);

          // connect to trace of upstream app
          let traceparentData;
          if (ctx.request.get("sentry-trace")) {
            traceparentData = Sentry.extractTraceparentData(
              ctx.request.get("sentry-trace")
            );
          }

          const transaction = Sentry.startTransaction({
            name: \`\${reqMethod} \${reqUrl}\`,
            op: "http.server",
            ...traceparentData,
          });

          ctx.__sentry_transaction = transaction;

          // We put the transaction on the scope so users can attach children to it
          Sentry.getCurrentHub().configureScope((scope) => {
            scope.setSpan(transaction);
          });

          ctx.res.on("finish", () => {
            // Push \`transaction.finish\` to the next event loop so open spans have a chance to finish before the transaction closes
            setImmediate(() => {
              // if using koa router, a nicer way to capture transaction using the matched route
              if (ctx._matchedRoute) {
                const mountPath = ctx.mountPath || "";
                transaction.setName(\`\${reqMethod} \${mountPath}\${ctx._matchedRoute}\`);
              }
              transaction.setHttpStatus(ctx.status);
              transaction.finish();
            });
          });

          await next();
        };

        app.use(requestHandler);
        app.use(tracingMiddleWare);

        // usual error handler
        app.on("error", (err, ctx) => {
          Sentry.withScope((scope) => {
            scope.addEventProcessor((event) => {
              return Sentry.addRequestDataToEvent(event, ctx.request);
            });
            Sentry.captureException(err);
          });
        });

        app.listen(3000);
        `,
      },
    ],
  },
  getUploadSourceMapsStep('https://docs.sentry.io/platforms/node/guides/koa/sourcemaps'),
  {
    type: StepType.VERIFY,
    description: t(
      "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        app.use(async function () {
          throw new Error("My first Sentry error!");
        });
        `,
      },
    ],
  },
];

export function GettingStartedWithKoa({dsn, ...props}: ModuleProps) {
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
    <Layout steps={steps({sentryInitContent: sentryInitContent.join('\n')})} {...props} />
  );
}

export default GettingStartedWithKoa;
