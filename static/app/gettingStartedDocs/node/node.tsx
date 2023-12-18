import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';
import {
  getDefaultNodeImports,
  getInstallSnippet,
  ProductSelectionMap,
} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const productSelection = (params: Params): ProductSelectionMap => {
  return {
    [ProductSolution.ERROR_MONITORING]: true,
    [ProductSolution.PROFILING]: params.isProfilingSelected,
    [ProductSolution.PERFORMANCE_MONITORING]: params.isPerformanceSelected,
    [ProductSolution.SESSION_REPLAY]: params.isReplaySelected,
  };
};

const getSdkSetupSnippet = (params: Params) => `
${getDefaultNodeImports({productSelection: productSelection(params)}).join('\n')}

Sentry.init({
  dsn: "${params.dsn}",
  ${
    params.isProfilingSelected
      ? `integrations: [
    new ProfilingIntegration(),
  ],`
      : ''
  }${
    params.isPerformanceSelected
      ? `
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions`
      : ''
  }${
    params.isProfilingSelected
      ? `
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,`
      : ''
  }
});
`;

const onboarding: OnboardingConfig = {
  install: (params: Params) => [
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
              code: getInstallSnippet({
                productSelection: productSelection(params),
                packageManager: 'npm',
              }),
            },
            {
              label: 'yarn',
              value: 'yarn',
              language: 'bash',
              code: getInstallSnippet({
                productSelection: productSelection(params),
                packageManager: 'yarn',
              }),
            },
          ],
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        "Initialize Sentry as early as possible in your application's lifecycle, for example in your [code:index.ts/js] entry point:",
        {code: <code />}
      ),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/node/sourcemaps/',
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
          code: `
  const transaction = Sentry.startTransaction({
    op: "test",
    name: "My First Test Transaction",
  });

  setTimeout(() => {
    try {
      foo();
    } catch (e) {
      Sentry.captureException(e);
    } finally {
      transaction.finish();
    }
  }, 99);
          `,
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
};

export default docs;
