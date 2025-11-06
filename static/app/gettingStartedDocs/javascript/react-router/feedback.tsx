import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigureDescription} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';

import {onboarding} from './onboarding';
import {getClientSetupSnippet} from './utils';

export const feedback: OnboardingConfig = {
  install: (params: DocsParams) => onboarding.install(params),
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getFeedbackConfigureDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/javascript/guides/react-router/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/javascript/guides/react-router/user-feedback/configuration/#bring-your-own-button',
          }),
        },
        {
          type: 'code',
          language: 'tsx',
          code: getClientSetupSnippet(params),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};
