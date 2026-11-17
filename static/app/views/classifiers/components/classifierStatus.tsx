import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {openConfirmModal} from '@sentry/scraps/confirm';
import {toast} from '@sentry/scraps/toast';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {useUpdateClassifier} from 'sentry/views/classifiers/hooks/useClassifier';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

function useCanEditClassifier(classifier: TelemetryClassifier) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: classifier.projectId});
  return hasEveryAccess(['project:write'], {organization, project});
}

function useUpdateClassifierStatus(classifier: TelemetryClassifier) {
  const {mutate, isPending} = useUpdateClassifier(classifier.id);

  const setStatus = (status: TelemetryClassifier['status']) =>
    mutate(
      {status},
      {
        onSuccess: data => {
          toast.success(
            data.status === 'enabled' ? t('Classifier enabled') : t('Classifier disabled')
          );
        },
        onError: () => {
          toast.error(
            status === 'enabled'
              ? t('Failed to enable classifier')
              : t('Failed to disable classifier')
          );
        },
      }
    );

  return {setStatus, isPending};
}

function getDisabledMessage(classifier: TelemetryClassifier) {
  return classifier.dataset === 'conversation'
    ? t('This classifier is disabled and is not classifying new conversations.')
    : t('This classifier is disabled and is not classifying new spans.');
}

const NO_PERMISSION_TOOLTIP = t(
  'You do not have permission to change the status of this classifier'
);

export function ClassifierStatusToggle({classifier}: {classifier: TelemetryClassifier}) {
  const canEdit = useCanEditClassifier(classifier);
  const {setStatus, isPending} = useUpdateClassifierStatus(classifier);
  const isEnabled = classifier.status === 'enabled';

  const handleClick = () => {
    if (!isEnabled) {
      setStatus('enabled');
      return;
    }

    openConfirmModal({
      message:
        classifier.dataset === 'conversation'
          ? t(
              'Are you sure you want to disable this classifier? New conversations will no longer be classified.'
            )
          : t(
              'Are you sure you want to disable this classifier? New spans will no longer be classified.'
            ),
      confirmText: t('Disable'),
      priority: 'danger',
      onConfirm: () => setStatus('disabled'),
    });
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPending || !canEdit}
      tooltipProps={{title: canEdit ? undefined : NO_PERMISSION_TOOLTIP}}
    >
      {isEnabled ? t('Disable') : t('Enable')}
    </Button>
  );
}

export function ClassifierDisabledAlert({classifier}: {classifier: TelemetryClassifier}) {
  if (classifier.status !== 'disabled') {
    return null;
  }

  return <Alert variant="muted">{getDisabledMessage(classifier)}</Alert>;
}
