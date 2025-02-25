import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';

export function getWizardInstallSnippet({
  platform,
  params,
}: {
  params: DocsParams;
  platform: 'ios' | 'android' | 'flutter' | 'reactNative';
}) {
  const {isSelfHosted, organization, projectSlug} = params;
  const urlParam = isSelfHosted ? '' : '--saas';

  return [
    {
      label: 'brew',
      value: 'brew',
      language: 'bash',
      code: `brew install getsentry/tools/sentry-wizard && sentry-wizard -i ${platform} ${urlParam} --org ${organization.slug} --project ${projectSlug}`,
    },
    {
      label: 'npx',
      value: 'npx',
      language: 'bash',
      code: `npx @sentry/wizard@latest -i ${platform} ${urlParam} --org ${organization.slug} --project ${projectSlug}`,
    },
  ];
}
