import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';

interface RequestSdkAccessButtonProps {
  organization: Organization;
  origin: 'onboarding' | 'project-creation' | 'project-settings';
  project: Project;
}

export function RequestSdkAccessButton({
  organization,
  project,
  origin,
}: RequestSdkAccessButtonProps) {
  return (
    <Button
      priority="default"
      size="sm"
      data-test-id="request-sdk-access"
      icon={<IconLock locked />}
      onClick={() => {
        openPrivateGamingSdkAccessModal({
          organization,
          projectSlug: project.slug,
          projectId: project.id,
          sdkName: 'PlayStation',
          gamingPlatform: 'playstation',
          origin,
          onSubmit: () => {
            trackAnalytics('tempest.sdk_access_modal_submitted', {
              organization,
              project_slug: project.slug,
              origin,
            });
          },
        });
        trackAnalytics('tempest.sdk_access_modal_opened', {
          organization,
          project_slug: project.slug,
          origin,
        });
      }}
    >
      {t('Request SDK Access')}
    </Button>
  );
}
