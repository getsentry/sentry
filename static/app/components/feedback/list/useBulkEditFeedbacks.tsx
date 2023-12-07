import {useCallback} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import useListItemCheckboxState from 'sentry/components/feedback/list/useListItemCheckboxState';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import {t, tct} from 'sentry/locale';
import {GroupStatus} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

const statusToText: Record<string, string> = {
  resolved: 'Resolve',
  unresolved: 'Unresolve',
};

interface Props
  extends Pick<
    ReturnType<typeof useListItemCheckboxState>,
    'deselectAll' | 'selectedIds'
  > {}

export default function useBulkEditFeedbacks({deselectAll, selectedIds}: Props) {
  const organization = useOrganization();
  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: selectedIds,
    organization,
  });

  const onToggleResovled = useCallback(
    (newMailbox: GroupStatus) => {
      openConfirmModal({
        bypass: Array.isArray(selectedIds) && selectedIds.length === 1,
        onConfirm: () => {
          addLoadingMessage(t('Updating feedbacks...'));
          resolve(newMailbox, {
            onError: () => {
              addErrorMessage(t('An error occurred while updating the feedbacks.'));
            },
            onSuccess: () => {
              addSuccessMessage(t('Updated feedbacks'));
              deselectAll();
            },
          });
        },
        message: tct('Are you sure you want to [status] these feedbacks?', {
          status: statusToText[newMailbox].toLowerCase(),
        }),
        confirmText: statusToText[newMailbox],
      });
    },
    [deselectAll, resolve, selectedIds]
  );

  const onMarkAsRead = useCallback(
    () =>
      openConfirmModal({
        bypass: Array.isArray(selectedIds) && selectedIds.length === 1,
        onConfirm: () => {
          addLoadingMessage(t('Updating feedbacks...'));
          markAsRead(true, {
            onError: () => {
              addErrorMessage(t('An error occurred while updating the feedbacks.'));
            },
            onSuccess: () => {
              addSuccessMessage(t('Updated feedbacks'));
              deselectAll();
            },
          });
        },
        message: t('Are you sure you want to mark these feedbacks as read?'),
        confirmText: 'Mark read',
      }),
    [deselectAll, markAsRead, selectedIds]
  );

  const onMarkUnread = useCallback(
    () =>
      openConfirmModal({
        bypass: Array.isArray(selectedIds) && selectedIds.length === 1,
        onConfirm: () => {
          addLoadingMessage(t('Updating feedbacks...'));
          markAsRead(false, {
            onError: () => {
              addErrorMessage(t('An error occurred while updating the feedbacks.'));
            },
            onSuccess: () => {
              addSuccessMessage(t('Updated feedbacks'));
              deselectAll();
            },
          });
        },
        message: t('Are you sure you want to mark these feedbacks as unread?'),
        confirmText: 'Mark unread',
      }),
    [deselectAll, markAsRead, selectedIds]
  );

  return {
    onToggleResovled,
    onMarkAsRead,
    onMarkUnread,
  };
}
