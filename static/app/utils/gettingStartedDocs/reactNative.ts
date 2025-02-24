import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';

export function getInstallConfig(
  params: DocsParams,
  {basePackage}: {basePackage: string}
) {
  return [
    {
      code: [
        {
          label: 'npm',
          value: 'npm',
          language: 'bash',
          code: `npm install ${basePackage} --save`,
        },
        {
          label: 'yarn',
          value: 'yarn',
          language: 'bash',
          code: `yarn add ${basePackage}`,
        },
        {
          label: 'pnpm',
          value: 'pnpm',
          language: 'bash',
          code: `pnpm add ${basePackage}`,
        },
      ],
    },
  ];
}
