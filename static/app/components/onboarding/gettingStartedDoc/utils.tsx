import ExternalLink from 'sentry/components/links/externalLink';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

export function getUploadSourceMapsStep({
  guideLink,
  organization,
  platformKey,
  projectId,
  newOrg,
}: {
  guideLink: string;
  newOrg?: boolean;
  organization?: Organization;
  platformKey?: PlatformKey;
  projectId?: string;
}) {
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
        code: `npx @sentry/wizard@latest -i sourcemaps`,
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

export const platformProductAvailability = {
  javascript: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.SESSION_REPLAY],
  'javascript-react': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-vue': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-angular': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-ember': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-gatsby': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-nextjs': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-remix': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-svelte': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-sveltekit': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
};
