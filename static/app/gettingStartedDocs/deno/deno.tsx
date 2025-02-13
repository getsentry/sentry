import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t} from 'sentry/locale';

type Params = DocsParams;

const getInstallConfig = () => [
  {
    code: [
      {
        label: 'Deno registry',
        value: 'deno',
        language: 'javascript',
        code: `import * as Sentry from "https://deno.land/x/sentry/index.mjs";"`,
      },
      {
        label: 'npm registry',
        value: 'npm',
        language: 'javascript',
        code: `import * as Sentry from "npm:@sentry/deno";`,
      },
    ],
  },
];

const getConfigureSnippet = (params: Params) =>
  `
Sentry.init({
  dsn: "${params.dsn.public}",${
    params.isPerformanceSelected
      ? `
  // enable performance
  tracesSampleRate: 1.0,`
      : ''
  }
});
`;

const getVerifySnippet = () => `;
setTimeout(() => {
  throw new Error();
});
`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: t(
        "Sentry captures data by using an SDK within your application's runtime."
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Initialize Sentry as early as possible in your application's lifecycle."
      ),
      configurations: [
        {
          language: 'javascript',
          code: getConfigureSnippet(params),
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
          code: getVerifySnippet(),
        },
      ],
    },
  ],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  feedbackOnboardingJsLoader,
};

export default docs;
