import {ExternalLink} from 'sentry/components/core/link';
import type {
  BasePlatformOptions,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {AwsLambdaArn} from 'sentry/gettingStartedDocs/node/awslambdaArnSelector';
import {t, tct} from 'sentry/locale';
import {
  getInstallConfig,
  getNodeAgentMonitoringOnboarding,
  getNodeProfilingOnboarding,
  getSdkInitSnippet,
} from 'sentry/utils/gettingStartedDocs/node';

export enum ModuleFormat {
  CJS = 'cjs',
  ESM = 'esm',
}

export const platformOptions = {
  moduleFormat: {
    label: t('Module Format'),
    items: [
      {
        label: t('CJS: Lambda Layer'),
        value: ModuleFormat.CJS,
      },
      {
        label: t('ESM: NPM Package'),
        value: ModuleFormat.ESM,
      },
    ],
    defaultValue: ModuleFormat.CJS,
  },
} satisfies BasePlatformOptions;

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const getEnvSetupSnippet = (params: Params) => `
NODE_OPTIONS="-r @sentry/aws-serverless/awslambda-auto"
SENTRY_DSN="${params.dsn.public}"
${params.isPerformanceSelected ? 'SENTRY_TRACES_SAMPLE_RATE=1.0' : ''}
`;

const getSdkSetupSnippet = (params: Params) => `
// IMPORTANT: Make sure to import and initialize Sentry at the top of your file.
${getSdkInitSnippet(params, 'aws', 'esm')}
// Place any other require/import statements here

exports.handler = Sentry.wrapHandler(async (event, context) => {
  // Your handler code
});`;

const moduleFormatOnboarding: Record<ModuleFormat, OnboardingConfig<PlatformOptions>> = {
  [ModuleFormat.CJS]: {
    introduction: () =>
      tct(
        'In this quick guide you’ll use set up Sentry for your AWS Lambda function. For more information visit [link:docs].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/aws-lambda/install/cjs-layer/" />
          ),
          strong: <strong />,
        }
      ),
    install: () => [
      {
        type: StepType.INSTALL,
        description: t(
          'Start off by selecting the region you want to deploy your Lambda function to'
        ),
        configurations: [
          {
            description: <AwsLambdaArn canonical="aws-layer:node" />,
          },
          {
            description: tct(
              'Add the Sentry Layer by navigating to your Lambda function. Select [strong:Layers], then [strong:Add a Layer]. Choose the [strong: Specify an ARN] option and paste the ARN from the previous step. Then click [strong:Add].',
              {
                strong: <strong />,
              }
            ),
          },
        ],
      },
    ],
    configure: params => [
      {
        type: StepType.CONFIGURE,
        description: tct(
          'To set environment variables, navigate to your Lambda function, select [strong:Configuration], then [strong:Environment variables]:',
          {
            strong: <strong />,
          }
        ),
        configurations: [
          {
            language: 'bash',
            code: getEnvSetupSnippet(params),
          },
        ],
      },
      getUploadSourceMapsStep({
        description: tct(
          'If you want to upload source maps for your Lambda function, you can do so by running the following command and following the instructions. If you prefer to manually set up source maps, please follow [guideLink:this guide].',
          {
            guideLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/aws-lambda/sourcemaps/" />
            ),
          }
        ),
        ...params,
      }),
    ],
    verify: () => [
      {
        type: StepType.VERIFY,
        description: t(
          "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
        ),
        configurations: [
          {
            language: 'javascript',
            code: `throw new Error("This should show up in Sentry!");`,
          },
        ],
      },
    ],
  },
  [ModuleFormat.ESM]: {
    introduction: () =>
      tct(
        'In this quick guide you’ll use set up Sentry for your AWS Lambda function. For more information visit [link:docs].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/aws-lambda/install/esm-npm/" />
          ),
          strong: <strong />,
        }
      ),
    install: (params: Params) => [
      {
        type: StepType.INSTALL,
        description: t('Add the Sentry AWS Serverless SDK as a dependency'),
        configurations: getInstallConfig(params, {
          basePackage: '@sentry/aws-serverless',
        }),
      },
    ],
    configure: (params: Params) => [
      {
        type: StepType.CONFIGURE,
        description: tct(
          "Ensure that Sentry is imported and initialized at the beginning of your file, prior to any other [code:require] or [code:import] statements. Then, wrap your lambda handler with Sentry's [code:wrapHandler] function:",
          {
            code: <code />,
          }
        ),
        configurations: [
          {
            language: 'javascript',
            code: getSdkSetupSnippet(params),
          },
        ],
      },
    ],
    verify: () => [
      {
        type: StepType.VERIFY,
        description: t(
          "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
        ),
        configurations: [
          {
            language: 'javascript',
            code: `
export const handler = Sentry.wrapHandler(async (event, context) => {
  throw new Error("This should show up in Sentry!")
});`,
          },
        ],
      },
    ],
  },
};

const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: (params: Params) =>
    moduleFormatOnboarding[params.platformOptions.moduleFormat].introduction?.(params),
  install: (params: Params) =>
    moduleFormatOnboarding[params.platformOptions.moduleFormat].install(params),
  configure: (params: Params) =>
    moduleFormatOnboarding[params.platformOptions.moduleFormat].configure(params),
  verify: (params: Params) =>
    moduleFormatOnboarding[params.platformOptions.moduleFormat].verify(params),
};

const crashReportOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/aws-lambda/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  crashReportOnboarding,
  profilingOnboarding: getNodeProfilingOnboarding({
    basePackage: '@sentry/aws-serverless',
  }),
  agentMonitoringOnboarding: getNodeAgentMonitoringOnboarding({
    basePackage: 'aws-serverless',
  }),
  platformOptions,
};

export default docs;
