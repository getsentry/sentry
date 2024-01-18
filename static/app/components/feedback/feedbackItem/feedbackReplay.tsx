import {Fragment} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ReplayInlineCTAPanel from 'sentry/components/feedback/feedbackItem/replayInlineCTAPanel';
import ReplaySection from 'sentry/components/feedback/feedbackItem/replaySection';
import {replayPlatforms} from 'sentry/data/platformCategories';
import type {Event, Organization} from 'sentry/types';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useReplayCountForFeedbacks from 'sentry/utils/replayCount/useReplayCountForFeedbacks';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
  organization: Organization;
}

export default function FeedbackReplay({eventData, feedbackItem, organization}: Props) {
  const {feedbackHasReplay} = useReplayCountForFeedbacks();
  const hasReplayId = feedbackHasReplay(feedbackItem.id);

  const replayId = eventData?.contexts?.feedback?.replay_id;
  const {hasSentOneReplay, fetching: isFetchingSentOneReplay} =
    useHaveSelectedProjectsSentAnyReplayEvents();
  const platformSupported = replayPlatforms.includes(feedbackItem.platform);

  if (!platformSupported) {
    return <Fragment>This platform isn't supported.</Fragment>;
  }

  if (replayId && hasReplayId) {
    return (
      <ErrorBoundary mini>
        <ReplaySection
          eventTimestampMs={new Date(feedbackItem.firstSeen).getTime()}
          organization={organization}
          replayId={replayId}
        />
      </ErrorBoundary>
    );
  }

  if ((replayId && hasReplayId === undefined) || isFetchingSentOneReplay) {
    return <Fragment>Checking things out...</Fragment>;
  }

  if (!hasSentOneReplay) {
    return <ReplayInlineCTAPanel />;
  }

  return <Fragment>No replay captured</Fragment>;
}
