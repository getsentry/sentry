import {Button} from '@sentry/scraps/button';
import {openConfirmModal} from '@sentry/scraps/confirm';
import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useCanEditClassifier} from 'sentry/views/classifiers/hooks/useCanEditClassifier';
import {useDeleteClassifier} from 'sentry/views/classifiers/hooks/useClassifier';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {getClassifiersPath} from 'sentry/views/classifiers/utils';

export function DeleteClassifierButton({classifier}: {classifier: TelemetryClassifier}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const canEdit = useCanEditClassifier(classifier);
  const {mutate: deleteClassifier, isPending} = useDeleteClassifier(classifier.id);

  const handleClick = () => {
    openConfirmModal({
      message: t(
        'Are you sure you want to delete this classifier? This action cannot be undone.'
      ),
      confirmText: t('Delete'),
      priority: 'danger',
      onConfirm: () =>
        deleteClassifier(undefined, {
          onSuccess: () => {
            toast.success(t('Classifier deleted'));
            navigate(getClassifiersPath(organization.slug));
          },
          onError: () => {
            toast.error(t('Failed to delete classifier'));
          },
        }),
    });
  };

  return (
    <Button
      variant="danger"
      onClick={handleClick}
      disabled={isPending || !canEdit}
      tooltipProps={{
        title: canEdit
          ? undefined
          : t('You do not have permission to delete this classifier'),
      }}
    >
      {t('Delete')}
    </Button>
  );
}
