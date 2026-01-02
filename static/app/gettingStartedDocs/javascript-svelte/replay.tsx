import {tracePropagationBlock} from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {tct} from 'sentry/locale';

import {getSdkSetupSnippet, installSnippetBlock} from './utils';

export const replay: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'You need a minimum version 7.27.0 of [code:@sentry/svelte] in order to use Session Replay. You do not need to install any additional packages.',
            {
              code: <code />,
            }
          ),
        },
        installSnippetBlock,
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getReplayConfigureDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/svelte/session-replay/',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Svelte v5',
              language: 'javascript',
              code: getSdkSetupSnippet(params, true),
            },
            {
              label: 'Svelte v3/v4',
              language: 'javascript',
              code: getSdkSetupSnippet(params, false),
            },
          ],
        },
        tracePropagationBlock,
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};
