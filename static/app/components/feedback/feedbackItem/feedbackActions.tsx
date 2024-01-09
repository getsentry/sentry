import {CSSProperties} from 'react';

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

  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: [feedbackItem.id],
    organization,
  });

  const mutationOptions = {
    onError: () => {
      addErrorMessage(t('An error occurred while updating the feedback.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Updated feedback'));
    },
  };

  const isResolved = feedbackItem.status === 'resolved';

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
