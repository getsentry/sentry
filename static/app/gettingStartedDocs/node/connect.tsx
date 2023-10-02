import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepProps, StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t} from 'sentry/locale';
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
  importContent: string;
  initContent: string;
  installSnippetNpm: string;
  installSnippetYarn: string;
  sourceMapStep: StepProps;
}

export const steps = ({
  installSnippetYarn,
  installSnippetNpm,
  importContent,
  initContent,
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
  sourceMapStep,
];

export function GettingStartedWithConnect({
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
        installSnippetNpm: getInstallSnippet({productSelection, packageManager: 'npm'}),
        installSnippetYarn: getInstallSnippet({productSelection, packageManager: 'yarn'}),
        importContent: imports.join('\n'),
        initContent,
        sourceMapStep: getUploadSourceMapsStep({
          guideLink: 'https://docs.sentry.io/platforms/node/guides/connect/sourcemaps/',
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

export default GettingStartedWithConnect;
