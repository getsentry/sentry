import type {CSSProperties} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Button from 'sentry/components/actions/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackAssignedTo from 'sentry/components/feedback/feedbackItem/feedbackAssignedTo';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import {Flex} from 'sentry/components/profiling/flex';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import {GroupStatus} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackActions({
  className,
  eventData,
  feedbackItem,
  style,
}: Props) {
  const organization = useOrganization();
  const hasSpamFeature = organization.features.includes('user-feedback-spam-filter-ui');

  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: [feedbackItem.id],
    organization,
    projectIds: [feedbackItem.project.id],
  });

  const mutationOptions = {
    onError: () => {
      addErrorMessage(t('An error occurred while updating the feedback.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Updated feedback'));
    },
  };

  // reuse the issues ignored category for spam feedbacks
  const isResolved = feedbackItem.status === GroupStatus.RESOLVED;
  const isSpam = feedbackItem.status === GroupStatus.IGNORED;

  return (
    <Flex gap={space(0.5)} align="center" className={className} style={style}>
      <ErrorBoundary mini>
        <FeedbackAssignedTo feedbackIssue={feedbackItem} feedbackEvent={eventData} />
      </ErrorBoundary>

      <Button
        onClick={() => {
          addLoadingMessage(t('Updating feedback...'));
          markAsRead(!feedbackItem.hasSeen, mutationOptions);
        }}
      >
        {feedbackItem.hasSeen ? t('Mark Unread') : t('Mark Read')}
      </Button>
      {hasSpamFeature && (
        <Button
          priority="default"
          onClick={() => {
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
          }}
        >
          {isSpam ? t('Move to Inbox') : t('Mark as Spam')}
        </Button>
      )}
      <Button
        priority={isResolved ? 'danger' : 'primary'}
        onClick={() => {
          addLoadingMessage(t('Updating feedback...'));
          const newStatus = isResolved ? GroupStatus.UNRESOLVED : GroupStatus.RESOLVED;
          resolve(newStatus, mutationOptions);
        }}
      >
        {isResolved ? t('Unresolve') : t('Resolve')}
      </Button>
    </Flex>
  );
}
