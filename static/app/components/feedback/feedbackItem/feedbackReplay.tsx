import ErrorBoundary from 'sentry/components/errorBoundary';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import ReplayInlineCTAPanel from 'sentry/components/feedback/feedbackItem/replayInlineCTAPanel';
import ReplaySection from 'sentry/components/feedback/feedbackItem/replaySection';
import Placeholder from 'sentry/components/placeholder';
import {replayPlatforms} from 'sentry/data/platformCategories';
import {IconPlay} from 'sentry/icons';
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

  if (replayId && hasReplayId) {
    return (
      <Section icon={<IconPlay size="xs" />} title={t('Linked Replay')}>
        <ErrorBoundary mini>
          <ReplaySection
            eventTimestampMs={new Date(feedbackItem.firstSeen).getTime()}
            organization={organization}
            replayId={replayId}
          />
        </ErrorBoundary>
      </Section>
    );
  }

  if ((replayId && hasReplayId === undefined) || isFetchingSentOneReplay) {
    return (
      <Section icon={<IconPlay size="xs" />} title={t('Linked Replay')}>
        <Placeholder />
      </Section>
    );
  }

  if (!hasSentOneReplay && platformSupported) {
    return (
      <Section icon={<IconPlay size="xs" />} title={t('Linked Replay')}>
        <ReplayInlineCTAPanel />
      </Section>
    );
  }

  return null;
}
