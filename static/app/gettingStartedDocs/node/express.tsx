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
  '// enable HTTP calls tracing',
  'new Sentry.Integrations.Http({ tracing: true }),',
  '// enable Express.js middleware tracing',
  'new Sentry.Integrations.Express({ app }),',
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

const app = express();

Sentry.init({
${initContent}
});

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());${
          hasPerformanceMonitoring
            ? `

// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());`
            : ''
        }

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
        app.get("/debug-sentry", function mainHandler(req, res) {
          throw new Error("My first Sentry error!");
        });
        `,
      },
    ],
  },
];

export function GettingStartedWithExpress({
  dsn,
  newOrg,
  platformKey,
  activeProductSelection = [],
  organization,
  projectId,
  ...props
}: ModuleProps) {
  const productSelection = getProductSelectionMap(activeProductSelection);

  const imports = getDefaultNodeImports({productSelection});
  imports.push('import express from "express";');

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
        installSnippetNpm: getInstallSnippet({productSelection, packageManager: 'npm'}),
        installSnippetYarn: getInstallSnippet({productSelection, packageManager: 'yarn'}),
        importContent: imports.join('\n'),
        initContent,
        hasPerformanceMonitoring: productSelection['performance-monitoring'],
        sourceMapStep: getUploadSourceMapsStep({
          guideLink: 'https://docs.sentry.io/platforms/node/guides/express/sourcemaps/',
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

export default GettingStartedWithExpress;
