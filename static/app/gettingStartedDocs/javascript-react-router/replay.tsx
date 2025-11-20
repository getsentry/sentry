import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';

import {onboarding} from './onboarding';
import {getClientSetupSnippet} from './utils';

export const replay: OnboardingConfig = {
  install: (params: DocsParams) => onboarding.install(params),
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getReplayConfigureDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/react-router/session-replay/',
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
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};
