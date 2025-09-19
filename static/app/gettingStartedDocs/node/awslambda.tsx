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
  getCrashReportJavaScriptInstallSteps,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {AwsLambdaArn} from 'sentry/gettingStartedDocs/node/awslambdaArnSelector';
import {t, tct} from 'sentry/locale';
import {
  getInstallConfig,
  getNodeAgentMonitoringOnboarding,
  getNodeLogsOnboarding,
  getNodeMcpOnboarding,
  getNodeProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/node';

export enum InstallationMethod {
  LAMBDA_LAYER = 'lambdaLayer',
  NPM_PACKAGE = 'npmPackage',
}

export const platformOptions = {
  installationMethod: {
    label: t('Installation Method'),
    items: [
      {
        label: t('Lambda Layer'),
        value: InstallationMethod.LAMBDA_LAYER,
      },
      {
        label: t('NPM Package'),
        value: InstallationMethod.NPM_PACKAGE,
      },
    ],
    defaultValue: InstallationMethod.LAMBDA_LAYER,
  },
} satisfies BasePlatformOptions;

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const getEnvSetupSnippet = (params: Params) => `
NODE_OPTIONS="--import @sentry/aws-serverless/awslambda-auto"
SENTRY_DSN="${params.dsn.public}"
${params.isPerformanceSelected ? 'SENTRY_TRACES_SAMPLE_RATE=1.0' : ''}
`;

const commonOnboarding = {
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
} satisfies Partial<OnboardingConfig<PlatformOptions>>;

const installationMethodOnboarding: Record<
  InstallationMethod,
  OnboardingConfig<PlatformOptions>
> = {
  [InstallationMethod.LAMBDA_LAYER]: {
    introduction: () =>
      tct(
        "In this quick guide you'll use set up Sentry for your AWS Lambda function. For more information visit [link:docs].",
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/aws-lambda/install/layer/" />
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
    configure: commonOnboarding.configure,
    verify: commonOnboarding.verify,
  },
  [InstallationMethod.NPM_PACKAGE]: {
    introduction: () =>
      tct(
        'In this quick guide you’ll use set up Sentry for your AWS Lambda function. For more information visit [link:docs].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/aws-lambda/install/npm/" />
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
    configure: commonOnboarding.configure,
    verify: commonOnboarding.verify,
  },
};

const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: (params: Params) =>
    installationMethodOnboarding[
      params.platformOptions.installationMethod
    ].introduction?.(params),
  install: (params: Params) =>
    installationMethodOnboarding[params.platformOptions.installationMethod].install(
      params
    ),
  configure: (params: Params) =>
    installationMethodOnboarding[params.platformOptions.installationMethod].configure(
      params
    ),
  verify: (params: Params) =>
    installationMethodOnboarding[params.platformOptions.installationMethod].verify(
      params
    ),
};

const crashReportOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallSteps(params),
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
  logsOnboarding: getNodeLogsOnboarding({
    docsPlatform: 'aws-lambda',
    sdkPackage: '@sentry/aws-serverless',
  }),
  agentMonitoringOnboarding: getNodeAgentMonitoringOnboarding({
    basePackage: 'aws-serverless',
  }),
  mcpOnboarding: getNodeMcpOnboarding({
    basePackage: 'aws-serverless',
  }),
  platformOptions,
};

export default docs;
