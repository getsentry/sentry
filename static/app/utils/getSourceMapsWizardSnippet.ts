import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';

/**
 * Generate a standardized sourcemaps wizard command with organization and project slugs
 */
export function getSourceMapsWizardSnippet({
  isSelfHosted,
  organization,
  project,
}: Partial<Pick<DocsParams, 'isSelfHosted' | 'organization' | 'project'>>) {
  let command = 'npx @sentry/wizard@latest -i sourcemaps';

  if (!isSelfHosted) {
    command += ' --saas';
  }

  if (organization?.slug) {
    command += ` --org ${organization.slug}`;
  }

  if (project?.slug) {
    command += ` --project ${project.slug}`;
  }

  return command;
}
