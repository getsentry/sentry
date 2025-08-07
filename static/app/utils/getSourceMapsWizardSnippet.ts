/**
 * Generate a standardized sourcemaps wizard command with organization and project slugs
 */
export function getSourceMapsWizardSnippet({
  isSelfHosted,
  organization,
  projectSlug,
}: {
  isSelfHosted?: boolean;
  organization?: {slug: string};
  projectSlug?: string;
}) {
  let command = 'npx @sentry/wizard@latest -i sourcemaps';

  if (!isSelfHosted) {
    command += ' --saas';
  }

  if (organization?.slug) {
    command += ` --org ${organization.slug}`;
  }

  if (projectSlug) {
    command += ` --project ${projectSlug}`;
  }

  return command;
}
