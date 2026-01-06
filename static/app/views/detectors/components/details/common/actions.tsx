import {useCallback} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useUpdateDetector} from 'sentry/views/detectors/hooks';
import {useDeleteDetectorMutation} from 'sentry/views/detectors/hooks/useDeleteDetectorMutation';
import {
  makeMonitorDetailsPathname,
  makeMonitorTypePathname,
} from 'sentry/views/detectors/pathnames';
import {detectorTypeIsUserCreateable} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';

export function DisableDetectorAction({detector}: {detector: Detector}) {
  const {mutate: updateDetector, isPending: isUpdating} = useUpdateDetector();

  const toggleDisabled = useCallback(() => {
    const newEnabled = !detector.enabled;
    updateDetector(
      {
        detectorId: detector.id,
        enabled: newEnabled,
      },
      {
        onSuccess: data => {
          addSuccessMessage(data.enabled ? t('Monitor enabled') : t('Monitor disabled'));
        },
      }
    );
  }, [updateDetector, detector.enabled, detector.id]);

  const canEdit = useCanEditDetector({
    detectorType: detector.type,
    projectId: detector.projectId,
  });

  if (!canEdit) {
    return null;
  }

  return (
    <Button size="sm" onClick={toggleDisabled} disabled={isUpdating}>
      {detector.enabled ? t('Disable') : t('Enable')}
    </Button>
  );
}

export function EditDetectorAction({detector}: {detector: Detector}) {
  const organization = useOrganization();
  const canEdit = useCanEditDetector({
    detectorType: detector.type,
    projectId: detector.projectId,
  });

  const permissionTooltipText = detectorTypeIsUserCreateable(detector.type)
    ? tct(
        'You do not have permission to edit this monitor. Ask your organization owner or manager to [settingsLink:enable monitor access] for you.',
        {
          settingsLink: (
            <Link
              to={{
                pathname: `/settings/${organization.slug}/`,
                hash: 'alertsMemberWrite',
              }}
            />
          ),
        }
      )
    : t(
        'This monitor is managed by Sentry. Only organization owners and managers can edit it.'
      );

  return (
    <Tooltip
      title={canEdit ? undefined : permissionTooltipText}
      disabled={canEdit}
      isHoverable
    >
      <LinkButton
        to={`${makeMonitorDetailsPathname(organization.slug, detector.id)}edit/`}
        priority="primary"
        icon={<IconEdit />}
        size="sm"
        disabled={!canEdit}
      >
        {t('Edit')}
      </LinkButton>
    </Tooltip>
  );
}

export function DeleteDetectorAction({detector}: {detector: Detector}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {mutateAsync: deleteDetector, isPending: isDeleting} =
    useDeleteDetectorMutation();

  const handleDelete = useCallback(() => {
    openConfirmModal({
      message: t('Are you sure you want to delete this monitor?'),
      confirmText: t('Delete'),
      priority: 'danger',
      onConfirm: async () => {
        await deleteDetector(detector.id);
        navigate(makeMonitorTypePathname(organization.slug, detector.type));
      },
    });
  }, [deleteDetector, detector.id, detector.type, navigate, organization.slug]);

  const canEdit = useCanEditDetector({
    detectorType: detector.type,
    projectId: detector.projectId,
  });

  if (!canEdit) {
    return null;
  }

  return (
    <Button priority="danger" onClick={handleDelete} disabled={isDeleting} size="sm">
      {t('Delete')}
    </Button>
  );
}
