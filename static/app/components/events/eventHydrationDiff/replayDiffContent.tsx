import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import Placeholder from 'sentry/components/placeholder';
import {OpenReplayComparisonButton} from 'sentry/components/replays/breadcrumbs/openReplayComparisonButton';
import {ReplaySliderDiff} from 'sentry/components/replays/diff/replaySliderDiff';
import {ReplayGroupContextProvider} from 'sentry/components/replays/replayGroupContext';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {getReplayDiffOffsetsFromEvent} from 'sentry/utils/replays/getDiffTimestamps';
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

  const {leftOffsetMs, rightOffsetMs} = getReplayDiffOffsetsFromEvent(replay, event);

  return (
    <EventDataSection
      type="hydration-diff"
      title={t('Hydration Error Diff')}
      actions={
        <OpenReplayComparisonButton
          key="open-modal-button"
          leftOffsetMs={leftOffsetMs}
          replay={replay}
          rightOffsetMs={rightOffsetMs}
          surface="issue-details" // TODO: refactor once this component is used in more surfaces
          size="xs"
        >
          {t('Open Diff Viewer')}
        </OpenReplayComparisonButton>
      }
    >
      <ErrorBoundary mini>
        <ReplayGroupContextProvider groupId={group?.id} eventId={event.id}>
          <ReplaySliderDiff
            minHeight="355px"
            leftOffsetMs={leftOffsetMs}
            replay={replay}
            rightOffsetMs={rightOffsetMs}
          />
        </ReplayGroupContextProvider>
      </ErrorBoundary>
    </EventDataSection>
  );
}
