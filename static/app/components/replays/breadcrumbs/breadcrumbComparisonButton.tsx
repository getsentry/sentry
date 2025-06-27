import {OpenReplayComparisonButton} from 'sentry/components/replays/breadcrumbs/openReplayComparisonButton';
import {t} from 'sentry/locale';
import {getReplayDiffOffsetsFromFrame} from 'sentry/utils/replays/getDiffTimestamps';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import {isBreadcrumbFrame, isHydrationErrorFrame} from 'sentry/utils/replays/types';

interface Props {
  frame: ReplayFrame;
  replay: ReplayReader | null;
}

export function BreadcrumbComparisonButton({frame, replay}: Props) {
  if (!isBreadcrumbFrame(frame) || !isHydrationErrorFrame(frame) || !replay) {
    return null;
  }

  const {frameOrEvent, leftOffsetMs, rightOffsetMs} = getReplayDiffOffsetsFromFrame(
    replay,
    frame
  );

  return (
    <div>
      <OpenReplayComparisonButton
        frameOrEvent={frameOrEvent}
        initialLeftOffsetMs={leftOffsetMs}
        initialRightOffsetMs={rightOffsetMs}
        replay={replay}
        size="xs"
        surface="replay-breadcrumbs"
      >
        {t('Open Hydration Diff')}
      </OpenReplayComparisonButton>
    </div>
  );
}
