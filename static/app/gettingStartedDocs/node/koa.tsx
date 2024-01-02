import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepProps, StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';
import {
  getDefaultInitParams,
  getDefaultNodeImports,
  getInstallSnippet,
  getProductInitParams,
  getProductIntegrations,
  getProductSelectionMap,
  joinWithIndentation,
} from 'sentry/utils/gettingStartedDocs/node';

interface StepsParams {
  hasPerformanceMonitoring: boolean;
  importContent: string;
  initContent: string;
  installSnippetNpm: string;
  installSnippetYarn: string;
  sourceMapStep: StepProps;
}

const performanceIntegrations: string[] = [
  '// Automatically instrument Node.js libraries and frameworks',
  '...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),',
];

export const steps = ({
  installSnippetYarn,
  installSnippetNpm,
  importContent,
  initContent,
  hasPerformanceMonitoring,
  sourceMapStep,
}: StepsParams): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t('Add the Sentry Node SDK as a dependency:'),
    configurations: [
      {
        code: [
          {
            label: 'npm',
            value: 'npm',
            language: 'bash',
            code: installSnippetNpm,
          },
          {
            label: 'yarn',
            value: 'yarn',
            language: 'bash',
            code: installSnippetYarn,
          },
        ],
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
${importContent}

const app = new Koa();

Sentry.init({
${initContent}
});${
          hasPerformanceMonitoring
            ? `

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

// This tracing middleware creates a transaction per request
const tracingMiddleWare = async (ctx, next) => {
  const reqMethod = (ctx.method || "").toUpperCase();
  const reqUrl = ctx.url && stripUrlQueryAndFragment(ctx.url);

  // Connect to trace of upstream app
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
      // If you're using koa router, set the matched route as transaction name
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
app.use(tracingMiddleWare);`
            : ''
        }

// Send errors to Sentry
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
  sourceMapStep,
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

export function GettingStartedWithKoa({
  dsn,
  newOrg,
  platformKey,
  activeProductSelection = [],
  organization,
  projectId,
  ...props
}: ModuleProps) {
  const productSelection = getProductSelectionMap(activeProductSelection);

  const additionalPackages = productSelection['performance-monitoring']
    ? ['@sentry/utils']
    : [];

  let imports = getDefaultNodeImports({productSelection});
  imports = imports.concat([
    'import { stripUrlQueryAndFragment } from "@sentry/utils";',
    'import Koa from "koa";',
  ]);

  const integrations = [
    ...(productSelection['performance-monitoring'] ? performanceIntegrations : []),
    ...getProductIntegrations({productSelection}),
  ];

  const integrationParam =
    integrations.length > 0
      ? `integrations: [\n${joinWithIndentation(integrations)}\n],`
      : null;

  const initContent = joinWithIndentation([
    ...getDefaultInitParams({dsn}),
    ...(integrationParam ? [integrationParam] : []),
    ...getProductInitParams({productSelection}),
  ]);

  return (
    <Layout
      steps={steps({
        installSnippetNpm: getInstallSnippet({
          additionalPackages,
          productSelection,
          packageManager: 'npm',
        }),
        installSnippetYarn: getInstallSnippet({
          additionalPackages,
          productSelection,
          packageManager: 'yarn',
        }),
        importContent: imports.join('\n'),
        initContent,
        hasPerformanceMonitoring: productSelection['performance-monitoring'],
        sourceMapStep: getUploadSourceMapsStep({
          guideLink: 'https://docs.sentry.io/platforms/node/guides/koa/sourcemaps/',
          organization,
          platformKey,
          projectId,
          newOrg,
        }),
      })}
      newOrg={newOrg}
      platformKey={platformKey}
      {...props}
    />
  );
}
export default GettingStartedWithKoa;
