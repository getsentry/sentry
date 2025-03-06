import ExternalLink from 'sentry/components/links/externalLink';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';

export function getUploadSourceMapsStep({
  guideLink,
  organization,
  platformKey,
  projectId,
  newOrg,
  isSelfHosted,
}: DocsParams & {
  guideLink: string;
}) {
  const urlParam = isSelfHosted ? '' : '--saas';
  return {
    title: t('Upload Source Maps'),
    description: (
      <p>
        {tct(
          'Automatically upload your source maps to enable readable stack traces for Errors. If you prefer to manually set up source maps, please follow [guideLink:this guide].',
          {
            guideLink: <ExternalLink href={guideLink} />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: `npx @sentry/wizard@latest -i sourcemaps ${urlParam}`,
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
      },
    ],
  };
}
