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
    description: t('Add the Sentry Node SDK as a dependency:'),
    configurations: [
      {
        language: 'bash',
        code: installSnippet,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t('To set up Sentry error logging for an Azure Function:'),
    configurations: [
      {
        language: 'javascript',
        code: `
        "use strict";

${importContent}

Sentry.init({
${initContent}
});

module.exports = async function (context, req) {
  try {
    await notExistFunction();
  } catch (e) {
    Sentry.captureException(e);
    await Sentry.flush(2000);
  }

  context.res = {
    status: 200,
    body: "Hello from Azure Cloud Function!",
  };
};
        `,
      },
      {
        language: 'javascript',
        description: (
          <p>
            {tct(
              'Note: You need to call both [captureExceptionCode:captureException] and [flushCode:flush] for captured events to be successfully delivered to Sentry.',
              {captureExceptionCode: <code />, flushCode: <code />}
            )}
          </p>
        ),
      },
    ],
  },
  sourceMapStep,
];

export function GettingStartedWithAzurefunctions({
  dsn,
  newOrg,
  platformKey,
  activeProductSelection = [],
  organization,
  projectId,
}: ModuleProps) {
  const productSelection = getProductSelectionMap(activeProductSelection);

  const installSnippet = getInstallSnippet({productSelection});
  const imports = getDefaultNodeImports({productSelection});
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
            'https://docs.sentry.io/platforms/node/guides/azure-functions/sourcemaps/',
          organization,
          platformKey,
          projectId,
          newOrg,
        }),
      })}
      newOrg={newOrg}
      platformKey={platformKey}
    />
  );
}

export default GettingStartedWithAzurefunctions;
