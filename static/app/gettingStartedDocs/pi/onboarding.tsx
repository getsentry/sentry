import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const PI_GUIDE =
  'https://github.com/getsentry/sentry-agent-tracing/tree/main/packages/pi#readme';

/**
 * Pi is a coding agent. The `@sentry/pi` extension subscribes to Pi's extension
 * events and sends every session as a conversation, without the Sentry SDK.
 */
export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install the [code:@sentry/pi] extension:', {code: <code />}),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Terminal',
              language: 'bash',
              code: 'pi install npm:@sentry/pi',
            },
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      title: t('Configure'),
      content: [
        {
          type: 'text',
          text: tct(
            'Set your DSN in the environment Pi starts from. Without [code:SENTRY_DSN], the extension does nothing.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Shell',
              language: 'bash',
              code: `export SENTRY_DSN="${params.dsn.public}"`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'The extension sends full content: prompts, system prompts, model responses, tool arguments, and tool results. It also sends the repository remote URL, the current branch, and [code:git config user.email]. See the [link:Pi extension README] for details.',
            {code: <code />, link: <ExternalLink href={PI_GUIDE} />}
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Start Pi and send a prompt that calls a tool, then confirm a trace with [code:invoke_agent], [code:chat], and [code:execute_tool] spans shows up in Sentry. If nothing arrives, set [code:SENTRY_DEBUG=1] and check the debug log in your temp directory.',
            {code: <code />}
          ),
        },
      ],
    },
  ],
};
