import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/types';

export const installSnippetBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'bash',
      language: 'bash',
      code: 'npx astro add @sentry/astro',
    },
  ],
};
