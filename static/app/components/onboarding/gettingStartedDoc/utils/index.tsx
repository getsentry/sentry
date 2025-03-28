import ExternalLink from 'sentry/components/links/externalLink';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getWizardConfig} from 'sentry/utils/gettingStartedDocs/cliSdkWizard';

export function getUploadSourceMapsStep({
  guideLink,
  organization,
  platformKey,
  projectId,
  projectSlug,
  newOrg,
  isSelfHosted,
}: DocsParams & {
  guideLink: string;
}) {
  const description = (
    <p>
      {tct(
        'Automatically upload your source maps to enable readable stack traces for Errors. If you prefer to manually set up source maps, please follow [guideLink:this guide].',
        {
          guideLink: <ExternalLink href={guideLink} />,
        }
      )}
    </p>
  );

  // Create minimal config with just what getWizardSnippet needs
  // Cast as any to bypass type checking
  const wizardParams = {
    isSelfHosted,
    organization,
    projectSlug: projectSlug || String(projectId),
    // Provide a complete mock of sourcePackageRegistries with the expected structure
    sourcePackageRegistries: {
      isLoading: false,
      data: {
        'sentry.wizard': {
          version: '4.0.1',
        },
      },
    },
  } as any;

  return {
    title: t('Upload Source Maps'),
    configurations: [
      getWizardConfig(wizardParams, 'source-maps', {
        description,
        onCopy: () => {
          if (!organization || !projectId || !platformKey) {
            return;
          }

          trackAnalytics(
            newOrg
              ? 'onboarding.source_maps_wizard_button_copy_clicked'
              : 'project_creation.source_maps_wizard_button_copy_clicked',
            {
              project_id: projectId,
              platform: platformKey,
              organization,
            }
          );
        },
        onSelectAndCopy: () => {
          if (!organization || !projectId || !platformKey) {
            return;
          }

          trackAnalytics(
            newOrg
              ? 'onboarding.source_maps_wizard_selected_and_copied'
              : 'project_creation.source_maps_wizard_selected_and_copied',
            {
              project_id: projectId,
              platform: platformKey,
              organization,
            }
          );
        },
      }),
    ],
  };
}
