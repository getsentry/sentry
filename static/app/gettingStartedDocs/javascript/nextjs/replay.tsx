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
import {t, tct} from 'sentry/locale';

import {getInstallSnippet} from './utils';


export const replay: OnboardingConfig = {
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      content: [
        {type: 'text', text: t('Install the Next.js SDK using our installation wizard:')},
        {type: 'code', language: 'bash', code: getInstallSnippet(params)},
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
            link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/session-replay/',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              filename: 'sentry.client.config.js',
              language: 'javascript',
              code: getReplaySDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/nextjs";`,
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
            'Note: The Replay integration only needs to be added to your [code:sentry.client.config.js] file. Adding it to any server-side configuration files (like [code:instrumentation.ts]) will break your build because the Replay integration depends on Browser APIs.',
            {
              code: <code />,
            }
          ),
        },
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};
