import {ExternalLink} from 'sentry/components/core/link';
import type {
  ContentBlock,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

export function getInstallContent(params: DocsParams): ContentBlock[] {
  return [
    {
      type: 'text',
      text: tct(
        'Configure your app automatically by running the [wizardLink:Sentry wizard] in the root of your project.',
        {
          wizardLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nuxt/#install" />
          ),
        }
      ),
    },
    {
      type: 'code',
      language: 'bash',
      code: `npx @sentry/wizard@latest -i nuxt ${params.isSelfHosted ? '' : '--saas'}  --org ${params.organization.slug} --project ${params.project.slug}`,
    },
  ];
}

export const installSnippetBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'npm',
      language: 'bash',
      code: 'npm install --save @sentry/nuxt',
    },
    {
      label: 'yarn',
      language: 'bash',
      code: 'yarn add @sentry/nuxt',
    },
    {
      label: 'pnpm',
      language: 'bash',
      code: 'pnpm add @sentry/nuxt',
    },
  ],
};
