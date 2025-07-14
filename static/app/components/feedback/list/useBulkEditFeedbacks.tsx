import {useCallback, useMemo} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {useDeleteFeedback} from 'sentry/components/feedback/useDeleteFeedback';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import {t, tct} from 'sentry/locale';
import {GroupStatus} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {decodeList} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';

const statusToButtonLabel: Record<string, string> = {
  resolved: t('Resolve'),
  unresolved: t('Unresolve'),
  ignored: t('Mark as Spam'),
};

const statusToText: Record<string, string> = {
  resolved: 'resolved',
  unresolved: 'unresolved',
  ignored: 'spam',
};

interface Props
  extends Pick<
    ReturnType<typeof useListItemCheckboxContext>,
    'deselectAll' | 'selectedIds'
  > {}

export default function useBulkEditFeedbacks({deselectAll, selectedIds}: Props) {
  const organization = useOrganization();
  const queryView = useLocationQuery({
    fields: {
      project: decodeList,
    },
  });
  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: selectedIds,
    organization,
    projectIds: queryView.project,
  });
  // TODO: should only be true if you're a member of some of the projects of the
  // selected feedbacks... which is not currently available
  const enableMarkAsRead = true;

  const onDelete = useDeleteFeedback(selectedIds, queryView.project);
  const hasDelete = selectedIds !== 'all';
  const enableDelete = organization.access.includes('event:admin');

  const mutationOptions = useMemo(
    () => ({
      onError: () => {
        addErrorMessage(t('An error occurred while updating the feedbacks'));
      },
      onSuccess: () => {
        addSuccessMessage(t('Updated feedbacks'));
        deselectAll();
      },
    }),
    [deselectAll]
  );

  const onToggleResolved = useCallback(
    ({newMailbox, moveToInbox}: {newMailbox: GroupStatus; moveToInbox?: boolean}) => {
      openConfirmModal({
        bypass: Array.isArray(selectedIds) && selectedIds.length === 1,
        onConfirm: () => {
          if (newMailbox === GroupStatus.IGNORED) {
            // target action is marking as spam aka ignored
            trackAnalytics('feedback.mark-spam-clicked', {
              organization,
              type: 'bulk',
            });
          }
          addLoadingMessage(t('Updating feedbacks...'));
          resolve(newMailbox, mutationOptions);
        },
        message: moveToInbox
          ? t('Are you sure you want to move these feedbacks to the inbox?')
          : tct('Are you sure you want to mark these feedbacks as [status]?', {
              status: statusToText[newMailbox],
            }),
        confirmText: moveToInbox ? t('Move to Inbox') : statusToButtonLabel[newMailbox],
      });
    },
    [selectedIds, resolve, mutationOptions, organization]
  );

  const onMarkAsRead = useCallback(
    () =>
      openConfirmModal({
        bypass: Array.isArray(selectedIds) && selectedIds.length === 1,
        onConfirm: () => {
          addLoadingMessage(t('Updating feedbacks...'));
          markAsRead(true, mutationOptions);
        },
        message: t('Are you sure you want to mark these feedbacks as read?'),
        confirmText: 'Mark read',
      }),
    [markAsRead, mutationOptions, selectedIds]
  );

  const onMarkUnread = useCallback(
    () =>
      openConfirmModal({
        bypass: Array.isArray(selectedIds) && selectedIds.length === 1,
        onConfirm: () => {
          addLoadingMessage(t('Updating feedbacks...'));
          markAsRead(false, {
            onError: () => {
              addErrorMessage(t('An error occurred while updating the feedbacks'));
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
    hasDelete,
    enableDelete,
    onDelete,
    onToggleResolved,
    enableMarkAsRead,
    onMarkAsRead,
    onMarkUnread,
  };
}
