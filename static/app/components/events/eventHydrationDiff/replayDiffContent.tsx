import ErrorBoundary from 'sentry/components/errorBoundary';
import Placeholder from 'sentry/components/placeholder';
import {OpenReplayComparisonButton} from 'sentry/components/replays/breadcrumbs/openReplayComparisonButton';
import {DiffCompareContextProvider} from 'sentry/components/replays/diff/diffCompareContext';
import {ReplaySliderDiff} from 'sentry/components/replays/diff/replaySliderDiff';
import {ReplayGroupContextProvider} from 'sentry/components/replays/replayGroupContext';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {getReplayDiffOffsetsFromEvent} from 'sentry/utils/replays/getDiffTimestamps';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

interface Props {
  event: Event;
  group: Group | undefined;
  orgSlug: string;
  replaySlug: string;
}

export default function ReplayDiffContent({event, group, orgSlug, replaySlug}: Props) {
  const replayContext = useLoadReplayReader({
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

  const {frameOrEvent, leftOffsetMs, rightOffsetMs} = getReplayDiffOffsetsFromEvent(
    replay,
    event
  );
  return (
    <InterimSection
      type={SectionKey.HYDRATION_DIFF}
      title={t('Hydration Error Diff')}
      actions={
        <OpenReplayComparisonButton
          frameOrEvent={frameOrEvent}
          initialLeftOffsetMs={leftOffsetMs}
          initialRightOffsetMs={rightOffsetMs}
          key="open-modal-button"
          replay={replay}
          size="xs"
          surface="issue-details" // TODO: refactor once this component is used in more surfaces
        >
          {t('Open Diff Viewer')}
        </OpenReplayComparisonButton>
      }
    >
      <ErrorBoundary mini>
        <ReplayGroupContextProvider groupId={group?.id} eventId={event.id}>
          <DiffCompareContextProvider
            replay={replay}
            frameOrEvent={frameOrEvent}
            initialLeftOffsetMs={leftOffsetMs}
            initialRightOffsetMs={rightOffsetMs}
          >
            <ReplaySliderDiff minHeight="355px" />
          </DiffCompareContextProvider>
        </ReplayGroupContextProvider>
      </ErrorBoundary>
    </InterimSection>
  );
}
