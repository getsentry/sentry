import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';

/**
 * Generate a standardized sourcemaps wizard command with organization and project slugs
 */
export function getSourceMapsWizardSnippet(params: DocsParams) {
  const {isSelfHosted, organization, projectSlug} = params;
  const urlParam = isSelfHosted ? '' : '--saas';

  const commandWithFlags = `sourcemaps ${urlParam} --org ${organization.slug} --project ${projectSlug}`;

  return {
    language: 'bash',
    code: `npx @sentry/wizard@latest -i ${commandWithFlags}`,
    onCopy: () => {
      if (!organization || !projectSlug || !params.platformKey) {
        return;
      }

      // Preserving any existing analytics
      if (typeof params.newOrg !== 'undefined') {
        const eventName = params.newOrg
          ? 'onboarding.source_maps_wizard_button_copy_clicked'
          : 'project_creation.source_maps_wizard_button_copy_clicked';

        import('sentry/utils/analytics').then(({trackAnalytics}) => {
          trackAnalytics(eventName, {
            project_id: params.projectId,
            platform: params.platformKey,
            organization,
          });
        });
      }
    },
    onSelectAndCopy: () => {
      if (!organization || !projectSlug || !params.platformKey) {
        return;
      }

      // Preserving any existing analytics
      if (typeof params.newOrg !== 'undefined') {
        const eventName = params.newOrg
          ? 'onboarding.source_maps_wizard_selected_and_copied'
          : 'project_creation.source_maps_wizard_selected_and_copied';

        import('sentry/utils/analytics').then(({trackAnalytics}) => {
          trackAnalytics(eventName, {
            project_id: params.projectId,
            platform: params.platformKey,
            organization,
          });
        });
      }
    },
  };
}
