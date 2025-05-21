import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';

export function SampleEventAlert({
  organization,
  project,
}: {
  organization: Organization;
  project: AvatarProject;
}) {
  return (
    <Alert
      system
      type="info"
      icon={<IconLightning />}
      trailingItems={
        <LinkButton
          size="xs"
          priority="primary"
          to={`/${organization.slug}/${project.slug}/getting-started/${
            project.platform || ''
          }`}
          onClick={() =>
            trackAnalytics('growth.sample_error_onboarding_link_clicked', {
              project_id: project.id?.toString(),
              organization,
              platform: project.platform,
            })
          }
        >
          {t('Get Started')}
        </LinkButton>
      }
    >
      {t(
        'You are viewing a sample error. Configure Sentry to start viewing real errors.'
      )}
    </Alert>
  );
}
