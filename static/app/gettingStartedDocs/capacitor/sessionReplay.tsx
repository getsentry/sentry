import {tracePropagationBlock} from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';

import {onboarding} from './onboarding';
import {getSetupConfiguration, type PlatformOptions} from './utils';

export const sessionReplay: OnboardingConfig<PlatformOptions> = {
  install: params => onboarding.install(params),
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getReplayConfigureDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/capacitor/session-replay/',
          }),
        },
        ...getSetupConfiguration({
          params,
          showExtraStep: false,
          showDescription: false,
        }),
        tracePropagationBlock,
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};
