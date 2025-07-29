import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {IconCode} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';

interface RequestSdkAccessButtonProps {
  organization: Organization;
  project: Project;
}

export function RequestSdkAccessButton({
  organization,
  project,
}: RequestSdkAccessButtonProps) {
  return (
    <Button
      priority="default"
      size="sm"
      data-test-id="request-sdk-access"
      icon={<IconCode />}
      onClick={() => {
        trackAnalytics('tempest.sdk_access_modal_opened', {
          organization,
          project_slug: project.slug,
        });
        openPrivateGamingSdkAccessModal({
          organization,
          projectSlug: project.slug,
          sdkName: 'PlayStation',
          gamingPlatform: 'playstation',
        });
      }}
    >
      {t('Request SDK Access')}
    </Button>
  );
}
