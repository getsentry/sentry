import {Fragment} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ReplayInlineCTAPanel from 'sentry/components/feedback/feedbackItem/replayInlineCTAPanel';
import ReplaySection from 'sentry/components/feedback/feedbackItem/replaySection';
import Placeholder from 'sentry/components/placeholder';
import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
import ReplayUnsupportedAlert from 'sentry/components/replays/alerts/replayUnsupportedAlert';
import {replayPlatforms} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
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

  if (!platformSupported && !(feedbackItem.platform === 'other')) {
    return (
      <ReplayUnsupportedAlert
        primaryAction="create"
        projectSlug={feedbackItem.project.slug}
      />
    );
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
    return <Placeholder />;
  }

  if (!hasSentOneReplay && platformSupported) {
    return <ReplayInlineCTAPanel />;
  }

  if (replayId) {
    return <MissingReplayAlert orgSlug={organization.slug} />;
  }

  return <Fragment>{t('No replay captured')}</Fragment>;
}
