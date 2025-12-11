import {useMemo} from 'react';

import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import type {PrivateGamingSdkAccessModalProps} from 'sentry/components/modals/privateGamingSdkAccessModal';
import {IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useReopenGamingSdkModal} from 'sentry/utils/useReopenGamingSdkModal';

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
  const buttonProps: PrivateGamingSdkAccessModalProps = useMemo(
    () => ({
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
    }),
    [organization, project.slug, project.id, origin]
  );

  useReopenGamingSdkModal(buttonProps);

  return (
    <Button
      priority="default"
      size="sm"
      data-test-id="request-sdk-access"
      icon={<IconLock locked />}
      onClick={() => {
        openPrivateGamingSdkAccessModal(buttonProps);
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
