import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/types';

export const installCodeBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'npm',
      language: 'bash',
      code: 'npm install --save @sentry/electron',
    },
    {
      label: 'yarn',
      language: 'bash',
      code: 'yarn add @sentry/electron',
    },
    {
      label: 'pnpm',
      language: 'bash',
      code: 'pnpm add @sentry/electron',
    },
  ],
};
