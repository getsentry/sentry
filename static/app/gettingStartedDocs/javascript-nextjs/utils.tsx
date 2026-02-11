import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';

export function getInstallSnippet({isSelfHosted, organization, project}: DocsParams) {
  const urlParam = isSelfHosted ? '' : '--saas';
  return `npx @sentry/wizard@latest -i nextjs ${urlParam} --org ${organization.slug} --project ${project.slug}`;
}
