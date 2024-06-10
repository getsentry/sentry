import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import Placeholder from 'sentry/components/placeholder';
import {OpenReplayComparisonButton} from 'sentry/components/replays/breadcrumbs/openReplayComparisonButton';
import ReplayDiff, {DiffType} from 'sentry/components/replays/replayDiff';
import {ReplayGroupContextProvider} from 'sentry/components/replays/replayGroupContext';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';

interface Props {
  event: Event;
  group: Group | undefined;
  orgSlug: string;
  replaySlug: string;
}

export default function ReplayDiffContent({event, group, orgSlug, replaySlug}: Props) {
  const replayContext = useReplayReader({
    orgSlug,
    replaySlug,
  });
  const {fetching, replay} = replayContext;

  if (fetching) {
    return <Placeholder />;
  }

  if (!replay) {
    return null;
  }

  // TODO: base the event timestamp off the replay data itself.
  const startTimestampMS =
    'startTimestamp' in event ? event.startTimestamp * 1000 : undefined;
  const timeOfEvent = event.dateCreated ?? startTimestampMS ?? event.dateReceived;
  const eventTimestampMs = timeOfEvent ? Math.floor(new Date(timeOfEvent).getTime()) : 0;

  return (
    <EventDataSection
      type="hydration-diff"
      title={t('Hydration Error Diff')}
      actions={
        <OpenReplayComparisonButton
          key="open-modal-button"
          leftTimestamp={0}
          replay={replay}
          rightTimestamp={eventTimestampMs}
          size="xs"
        >
          {t('Open Diff Viewer')}
        </OpenReplayComparisonButton>
      }
    >
      <ErrorBoundary mini>
        <ReplayGroupContextProvider groupId={group?.id} eventId={event.id}>
          <ReplayDiff
            defaultTab={DiffType.VISUAL}
            leftTimestamp={0}
            replay={replay}
            rightTimestamp={eventTimestampMs}
          />
        </ReplayGroupContextProvider>
      </ErrorBoundary>
    </EventDataSection>
  );
}
