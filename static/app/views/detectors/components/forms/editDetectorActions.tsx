import {useCallback} from 'react';

import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useDeleteDetectorMutation} from 'sentry/views/detectors/hooks/useDeleteDetectorMutation';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

interface EditDetectorActionsProps {
  detectorId: Detector['id'];
}

export function EditDetectorActions({detectorId}: EditDetectorActionsProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {mutate: deleteDetector, isPending: isDeleting} = useDeleteDetectorMutation();

  const handleDelete = useCallback(() => {
    openConfirmModal({
      message: t('Are you sure you want to delete this monitor?'),
      confirmText: t('Delete'),
      priority: 'danger',
      onConfirm: () => {
        deleteDetector(detectorId, {
          onSuccess: () => {
            navigate(makeMonitorBasePathname(organization.slug));
          },
        });
      },
    });
  }, [deleteDetector, detectorId, navigate, organization.slug]);

  return (
    <div>
      <ButtonBar>
        <Button type="button" priority="default" size="sm" onClick={() => {}}>
          {t('Disable')}
        </Button>
        <Button
          priority="danger"
          onClick={handleDelete}
          disabled={isDeleting}
          busy={isDeleting}
          size="sm"
        >
          {t('Delete')}
        </Button>
        <Button type="submit" priority="primary" size="sm">
          {t('Save')}
        </Button>
      </ButtonBar>
    </div>
  );
}
