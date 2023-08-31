import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
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

interface StepProps {
  importContent: string;
  initContent: string;
  installSnippet: string;
}

export const steps = ({
  installSnippet,
  importContent,
  initContent,
}: StepProps): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: <p>{tct('Add Sentry Node SDK as a dependency:', {code: <code />})}</p>,
    configurations: [
      {
        language: 'bash',
        code: installSnippet,
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
${importContent}

// Configure Sentry before doing anything else
Sentry.init({
${initContent}
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

export function GettingStartedWithConnect({
  dsn,
  newOrg,
  platformKey,
  activeProductSelection = [],
}: ModuleProps) {
  const productSelection = getProductSelectionMap(activeProductSelection);

  const installSnippet = getInstallSnippet({productSelection});
  const imports = getDefaultNodeImports({productSelection});
  imports.push('import connect from "connect";');

  const integrations = getProductIntegrations({productSelection});
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
        installSnippet,
        importContent: imports.join('\n'),
        initContent,
      })}
      newOrg={newOrg}
      platformKey={platformKey}
    />
  );
}

export default GettingStartedWithConnect;
