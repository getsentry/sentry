import {useCallback, useMemo} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {useDeleteFeedback} from 'sentry/components/feedback/useDeleteFeedback';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import {t, tct, tn} from 'sentry/locale';
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

interface Props extends Pick<
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

  const selectedIdsLength =
    selectedIds === 'all' ? Number.MAX_SAFE_INTEGER : selectedIds.length;

  const mutationOptions = useMemo(
    () => ({
      onError: () => {
        addErrorMessage(
          tn(
            'An error occurred while updating the feedback item',
            'An error occurred while updating the feedback items',
            selectedIdsLength
          )
        );
      },
      onSuccess: () => {
        addSuccessMessage(
          tn('Updated feedback item', 'Updated feedback items', selectedIdsLength)
        );
        deselectAll();
      },
    }),
    [deselectAll, selectedIdsLength]
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
          addLoadingMessage(
            tn(
              'Updating feedback item...',
              'Updating feedback items...',
              selectedIdsLength
            )
          );
          resolve(newMailbox, mutationOptions);
        },
        message: moveToInbox
          ? tn(
              'Are you sure you want to move this feedback item to the inbox?',
              'Are you sure you want to move these feedback items to the inbox?',
              selectedIdsLength
            )
          : selectedIdsLength === 1
            ? tct('Are you sure you want to mark this feedback item as [status]?', {
                status: statusToText[newMailbox],
              })
            : tct('Are you sure you want to mark these feedback items as [status]?', {
                status: statusToText[newMailbox],
              }),
        confirmText: moveToInbox ? t('Move to Inbox') : statusToButtonLabel[newMailbox],
      });
    },
    [selectedIds, selectedIdsLength, resolve, mutationOptions, organization]
  );

  const onMarkAsRead = useCallback(
    () =>
      openConfirmModal({
        bypass: Array.isArray(selectedIds) && selectedIds.length === 1,
        onConfirm: () => {
          addLoadingMessage(
            tn(
              'Updating feedback item...',
              'Updating feedback items...',
              selectedIdsLength
            )
          );
          markAsRead(true, mutationOptions);
        },
        message: tn(
          'Are you sure you want to mark this feedback item as read?',
          'Are you sure you want to mark these feedback items as read?',
          selectedIdsLength
        ),
        confirmText: 'Mark read',
      }),
    [markAsRead, mutationOptions, selectedIds, selectedIdsLength]
  );

  const onMarkUnread = useCallback(
    () =>
      openConfirmModal({
        bypass: Array.isArray(selectedIds) && selectedIds.length === 1,
        onConfirm: () => {
          addLoadingMessage(
            tn(
              'Updating feedback item...',
              'Updating feedback items...',
              selectedIdsLength
            )
          );
          markAsRead(false, {
            onError: () => {
              addErrorMessage(
                tn(
                  'An error occurred while updating the feedback item',
                  'An error occurred while updating the feedback items',
                  selectedIdsLength
                )
              );
            },
            onSuccess: () => {
              addSuccessMessage(
                tn('Updated feedback item', 'Updated feedback items', selectedIdsLength)
              );
              deselectAll();
            },
          });
        },
        message: tn(
          'Are you sure you want to mark this feedback item as unread?',
          'Are you sure you want to mark these feedback items as unread?',
          selectedIdsLength
        ),
        confirmText: 'Mark unread',
      }),
    [deselectAll, markAsRead, selectedIds, selectedIdsLength]
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
