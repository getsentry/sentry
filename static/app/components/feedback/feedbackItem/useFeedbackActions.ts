import {useCallback} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import {t} from 'sentry/locale';
import {GroupStatus} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackItem: FeedbackIssue
}

const mutationOptions = {
  onError: () => {
    addErrorMessage(t('An error occurred while updating the feedback.'));
  },
  onSuccess: () => {
    addSuccessMessage(t('Updated feedback'));
  },
};

export default function useActions({feedbackItem}:Props) {
  const organization = useOrganization();
  const hasSpamFeature = organization.features.includes('user-feedback-spam-filter-ui');

  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: [feedbackItem.id],
    organization,
    projectIds: [feedbackItem.project.id],
  });

  // reuse the issues ignored category for spam feedbacks
  const isResolved = feedbackItem.status === GroupStatus.RESOLVED;
  const isSpam = feedbackItem.status === GroupStatus.IGNORED;

  return {
    isResolved,
    onResolveClick: useCallback(() => {
      addLoadingMessage(t('Updating feedback...'));
      const newStatus = isResolved ? GroupStatus.UNRESOLVED : GroupStatus.RESOLVED;
      resolve(newStatus, mutationOptions);
    }, [isResolved, resolve]),
    hasSpamFeature,
    isSpam,
    onSpamClick: useCallback(() => {
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
    }, [isSpam, organization, resolve]),
    hasSeen: feedbackItem.hasSeen,
    onMarkAsReadClick: useCallback(() => {
      addLoadingMessage(t('Updating feedback...'));
      markAsRead(!feedbackItem.hasSeen, mutationOptions);
    }, [feedbackItem.hasSeen, markAsRead]),
  };
}
