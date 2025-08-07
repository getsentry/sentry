import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {IconCode} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useProjects from 'sentry/utils/useProjects';

interface RequestSdkAccessButtonProps {
  organization: Organization;
  projectSlug: string;
}

export function RequestSdkAccessButton({
  organization,
  projectSlug,
}: RequestSdkAccessButtonProps) {
  const {projects} = useProjects({slugs: [projectSlug]});
  const project = projects[0];

  if (!project) {
    return null;
  }

  return (
    <Button
      priority="default"
      size="sm"
      data-test-id="request-sdk-access"
      icon={<IconCode />}
      onClick={() => {
        openPrivateGamingSdkAccessModal({
          organization,
          projectSlug: project.slug,
          projectId: project.id,
          sdkName: 'PlayStation',
          gamingPlatform: 'playstation',
          onSubmit: () => {
            trackAnalytics('tempest.sdk_access_modal_submitted', {
              organization,
              project_slug: project.slug,
            });
          },
        });
        trackAnalytics('tempest.sdk_access_modal_opened', {
          organization,
          project_slug: project.slug,
        });
      }}
    >
      {t('Request SDK Access')}
    </Button>
  );
}
