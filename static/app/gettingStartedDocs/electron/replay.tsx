import {tracePropagationBlock} from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayConfigureDescription,
  getReplaySDKSetupSnippet,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {tct} from 'sentry/locale';

import {installCodeBlock} from './utils';

export const replay: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'For the Session Replay to work, you must have the framework SDK (e.g. [code:@sentry/electron]) installed, minimum version 4.2.0.',
            {
              code: <code />,
            }
          ),
        },
        installCodeBlock,
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getReplayConfigureDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/electron/session-replay/',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              language: 'javascript',
              label: 'JavaScript',
              code: getReplaySDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/electron/renderer";`,
                dsn: params.dsn.public,
                mask: params.replayOptions?.mask,
                block: params.replayOptions?.block,
              }),
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
