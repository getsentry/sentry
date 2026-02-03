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

import {getInstallContent} from './utils';

export const replay: OnboardingConfig = {
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      content: getInstallContent(params),
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getReplayConfigureDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/remix/session-replay/',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              filename: 'entry.client.tsx',
              language: 'javascript',
              code: getReplaySDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/remix";`,
                dsn: params.dsn.public,
                mask: params.replayOptions?.mask,
                block: params.replayOptions?.block,
              }),
            },
          ],
        },
        tracePropagationBlock,
        {
          type: 'text',
          text: tct(
            'Note: The Replay integration only needs to be added to your [code:entry.client.tsx] file. It will not run if it is added into [code:sentry.server.config.js].',
            {code: <code />}
          ),
        },
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};
