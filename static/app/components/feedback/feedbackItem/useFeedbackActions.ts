import {useCallback, useMemo} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import useRefetchFeedbackList from 'sentry/components/feedback/list/useRefetchFeedbackList';
import {useDeleteFeedback} from 'sentry/components/feedback/useDeleteFeedback';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import {t} from 'sentry/locale';
import {GroupStatus} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';

interface Props {
  feedbackItem: FeedbackIssue;
}

export default function useFeedbackActions({feedbackItem}: Props) {
  const organization = useOrganization();
  const projectId = feedbackItem.project?.id;

  const {refetchFeedbackList} = useRefetchFeedbackList();

  const mutationOptions = useMemo(
    () => ({
      onError: () => {
        addErrorMessage(t('An error occurred while updating the feedback.'));
      },
      onSuccess: () => {
        addSuccessMessage(t('Updated feedback'));
        refetchFeedbackList();
      },
    }),
    [refetchFeedbackList]
  );

  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: [feedbackItem.id],
    organization,
    projectIds: feedbackItem.project ? [feedbackItem.project.id] : [],
  });
  const project = useProjectFromId({project_id: feedbackItem.project?.id});
  const enableMarkAsRead = project?.isMember;

  const onDelete = useDeleteFeedback([feedbackItem.id], projectId);
  const enableDelete = organization.access.includes('event:admin');

  const isResolved = feedbackItem.status === GroupStatus.RESOLVED;
  const onResolveClick = useCallback(() => {
    addLoadingMessage(t('Updating feedback...'));
    const newStatus = isResolved ? GroupStatus.UNRESOLVED : GroupStatus.RESOLVED;
    resolve(newStatus, mutationOptions);
  }, [isResolved, resolve, mutationOptions]);

  // reuse the issues ignored category for spam feedbacks
  const isSpam = feedbackItem.status === GroupStatus.IGNORED;
  const onSpamClick = useCallback(() => {
    addLoadingMessage(t('Updating feedback...'));
    const newStatus = isSpam ? GroupStatus.UNRESOLVED : GroupStatus.IGNORED;
    resolve(newStatus, mutationOptions);
    if (!isSpam) {
      // not currently spam, clicking the button will turn it into spam
      trackAnalytics('feedback.mark-spam-clicked', {
        organization,
        type: 'details',
      });
    }
  }, [isSpam, organization, resolve, mutationOptions]);

  const hasSeen = feedbackItem.hasSeen;
  const onMarkAsReadClick = useCallback(() => {
    addLoadingMessage(t('Updating feedback...'));
    markAsRead(!hasSeen, mutationOptions);
  }, [hasSeen, markAsRead, mutationOptions]);

  return {
    enableDelete,
    onDelete,
    isResolved,
    onResolveClick,
    isSpam,
    onSpamClick,
    hasSeen,
    enableMarkAsRead,
    onMarkAsReadClick,
  };
}
