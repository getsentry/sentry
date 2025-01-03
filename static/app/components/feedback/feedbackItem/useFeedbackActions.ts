import {useCallback} from 'react';

import {GroupStatus} from 'sentry/types/group';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {useDeleteFeedback} from 'sentry/components/feedback/useDeleteFeedback';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackItem: FeedbackIssue;
}

const mutationOptions = {
  onError: () => {
    addErrorMessage(t('An error occurred while updating the feedback.'));
  },
  onSuccess: () => {
    addSuccessMessage(t('Updated feedback'));
  },
};

export default function useFeedbackActions({feedbackItem}: Props) {
  const organization = useOrganization();
  const projectId = feedbackItem.project?.id;

  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: [feedbackItem.id],
    organization,
    projectIds: feedbackItem.project ? [feedbackItem.project.id] : [],
  });
  const deleteFeedback = useDeleteFeedback([feedbackItem.id], projectId);

  const hasDelete = organization.features.includes('issue-platform-deletion-ui');
  const disableDelete = !organization.access.includes('event:admin');
  const onDelete = deleteFeedback;

  // reuse the issues ignored category for spam feedbacks
  const isResolved = feedbackItem.status === GroupStatus.RESOLVED;
  const onResolveClick = useCallback(() => {
    addLoadingMessage(t('Updating feedback...'));
    const newStatus = isResolved ? GroupStatus.UNRESOLVED : GroupStatus.RESOLVED;
    resolve(newStatus, mutationOptions);
  }, [isResolved, resolve]);

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
  }, [isSpam, organization, resolve]);

  const hasSeen = feedbackItem.hasSeen;
  const onMarkAsReadClick = useCallback(() => {
    addLoadingMessage(t('Updating feedback...'));
    markAsRead(!hasSeen, mutationOptions);
  }, [hasSeen, markAsRead]);

  return {
    disableDelete,
    hasDelete,
    onDelete,
    isResolved,
    onResolveClick,
    isSpam,
    onSpamClick,
    hasSeen,
    onMarkAsReadClick,
  };
}
