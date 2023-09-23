import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepProps, StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';
import {
  getDefaulServerlessImports,
  getDefaultInitParams,
  getInstallSnippet,
  getProductInitParams,
  getProductIntegrations,
  getProductSelectionMap,
  joinWithIndentation,
} from 'sentry/utils/gettingStartedDocs/node';

interface StepsParams {
  importContent: string;
  initContent: string;
  installSnippet: string;
  sourceMapStep: StepProps;
}

export const steps = ({
  installSnippet,
  importContent,
  initContent,
  sourceMapStep,
}: StepsParams): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: t('Add the Sentry Serverless SDK as a dependency:'),
    configurations: [
      {
        language: 'bash',
        code: installSnippet,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct("Wrap your lambda handler with Sentry's [code:wraphandler] function:", {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
${importContent}

Sentry.AWSLambda.init({
${initContent}
});

exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  // Your handler code
});
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
        exports.handler = Sentry.AWSLambda.wrapHandler(async (event, context) => {
          throw new Error("This should show up in Sentry!")
        });
        `,
      },
    ],
  },
];

export function GettingStartedWithAwsLambda({
  dsn,
  newOrg,
  platformKey,
  activeProductSelection = [],
  organization,
  projectId,
  ...props
}: ModuleProps) {
  const productSelection = getProductSelectionMap(activeProductSelection);

  const installSnippet = getInstallSnippet({
    productSelection,
    basePackage: '@sentry/serverless',
  });
  const imports = getDefaulServerlessImports({productSelection});
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
        sourceMapStep: getUploadSourceMapsStep({
          guideLink:
            'https://docs.sentry.io/platforms/node/guides/aws-lambda/sourcemaps/',
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

export default GettingStartedWithAwsLambda;
