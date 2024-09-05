import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
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

export function MobileBetaBanner({link}: {link: string}) {
  return (
    <Alert type="info" showIcon>
      {tct(
        `Currently, Mobile Replay is in beta. To learn more, you can [link:read our docs].`,
        {
          link: <ExternalLink href={link} />,
        }
      )}
    </Alert>
  );
}
