import {ExternalLink} from 'sentry/components/core/link';
import {tracePropagationBlock} from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplaySDKSetupSnippet,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t, tct} from 'sentry/locale';

import {installSnippetBlock} from './utils';

export const replay: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install the [code:@sentry/astro] package with the [code:astro] CLI:',
            {
              code: <code />,
            }
          ),
        },
        installSnippetBlock,
        {
          type: 'text',
          text: t('Session Replay is enabled by default when you install the Astro SDK!'),
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      title: 'Configure Session Replay (Optional)',
      collapsible: true,
      content: [
        {
          type: 'text',
          text: tct(
            'There are several privacy and sampling options available. Learn more about configuring Session Replay by reading the [link:configuration docs].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/astro/session-replay/" />
              ),
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            'Configure the Sentry integration in your [code:astro.config.mjs] file:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'astro.config.mjs',
              code: `
import { defineConfig } from "astro/config";
import sentry from "@sentry/astro";

export default defineConfig({
  integrations: [
    sentry({
      project: "${params.project.slug}",
      org: "${params.organization.slug}",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
                `,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Set sample rates and replay options in your [code:sentry.client.config.js] file:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              filename: 'sentry.client.config.js',
              code: getReplaySDKSetupSnippet({
                importStatement: `// This file overrides \`astro.config.mjs\` for the browser-side.
// SDK options from \`astro.config.mjs\` will not apply.
import * as Sentry from "@sentry/astro";`,
                dsn: params.dsn.public,
                mask: params.replayOptions?.mask,
                block: params.replayOptions?.block,
              }),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            `The [code:sentry.client.config.js] file allows you to configure client-side SDK options including replay settings. Learn more about manual SDK initialization [link:here].`,
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/astro/manual-setup/#manual-sdk-initialization" />
              ),
            }
          ),
        },
        tracePropagationBlock,
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};
