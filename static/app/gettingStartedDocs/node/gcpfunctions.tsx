import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';
import {
  getDefaulServerlessImports,
  getDefaultInitParams,
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
    description: (
      <p>
        {tct(
          'Add the Sentry Serverless SDK as a dependency to your [code:package.json]:',
          {code: <code />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'json',
        code: installSnippet,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct('Use the Sentry SDK to wrap your functions:', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
${importContent}

Sentry.GCPFunction.init({
  ${initContent}
});

// Use wrapHttpFunction to instrument your http functions
exports.helloHttp = Sentry.GCPFunction.wrapHttpFunction((req, res) => {
  /* Your function code */
});

// Use wrapEventFunction to instrument your background functions
exports.helloEvents = Sentry.GCPFunction.wrapEventFunction(
  (data, context, callback) => {
    /* Your function code */
  }
);

// Use wrapCloudEventFunction to instrument your CloudEvent functions
exports.helloEvents = Sentry.GCPFunction.wrapCloudEventFunction(
  (context, callback) => {
    /* Your function code */
  }
);
`,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
exports.helloHttp = Sentry.GCPFunction.wrapHttpFunction((req, res) => {
  throw new Error("oh, hello there!");
});
        `,
      },
    ],
  },
];

export function GettingStartedWithGCPFunctions({
  dsn,
  newOrg,
  platformKey,
  activeProductSelection = [],
}: ModuleProps) {
  const productSelection = getProductSelectionMap(activeProductSelection);

  const installSnippet: string[] = [
    'dependencies: {',
    '  //...',
    `  "@sentry/serverless": "^7",`,
  ];

  if (productSelection.profiling) {
    installSnippet.push(`  "@sentry/profiling-node": "^1",`);
  }
  installSnippet.push('  //...', '}');

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
        installSnippet: installSnippet.join('\n'),
        importContent: imports.join('\n'),
        initContent,
      })}
      newOrg={newOrg}
      platformKey={platformKey}
    />
  );
}

export default GettingStartedWithGCPFunctions;
