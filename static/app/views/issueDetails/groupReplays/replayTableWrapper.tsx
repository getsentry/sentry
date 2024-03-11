import {Fragment, useCallback} from 'react';

import ReplayClipPreviewPlayer from 'sentry/components/events/eventReplay/replayClipPreviewPlayer';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import ReplayTable from 'sentry/views/replays/replayTable';
import type {ReplayColumn} from 'sentry/views/replays/replayTable/types';

type Props = {
  orgSlug: string;
  pageLinks: string | null;
  replaySlug: string;
  selectedReplayIndex: number;
  setSelectedReplayIndex: (index: number | undefined) => void;
  visibleColumns: ReplayColumn[];
  nextReplayText?: string;
} & React.ComponentProps<typeof ReplayTable>;

function ReplayTableWrapper({
  replaySlug,
  nextReplayText,
  setSelectedReplayIndex,
  orgSlug,
  ...props
}: Props) {
  const {selectedReplayIndex} = props;
  const {analyticsContext} = useReplayContext();
  const replayContext = useReplayReader({
    orgSlug,
    replaySlug,
  });
  const {isFinished, isPlaying} = useReplayContext();

  const onClickPlay = useCallback(
    (index: number) => {
      // cause the component to unmount and remount so that the replay player can reset
      setSelectedReplayIndex(undefined);
      setTimeout(() => setSelectedReplayIndex(index), 0);
    },
    [setSelectedReplayIndex]
  );

  return (
    <Fragment>
      <ReplayClipPreviewPlayer
        overlayText={nextReplayText}
        orgSlug={orgSlug}
        showNextAndPrevious
        handleForwardClick={
          props.replays && selectedReplayIndex + 1 < props.replays.length
            ? () => {
                // unselect a replay then set it so we reset state
                setSelectedReplayIndex(undefined);
                setTimeout(() => setSelectedReplayIndex(selectedReplayIndex + 1), 0);
              }
            : undefined
        }
        handleBackClick={
          selectedReplayIndex > 0
            ? () => {
                setSelectedReplayIndex(undefined);
                setTimeout(() => setSelectedReplayIndex(selectedReplayIndex - 1), 0);
              }
            : undefined
        }
        onClickNextReplay={
          nextReplayText
            ? () => {
                // unselect a replay then set it so we reset state
                setSelectedReplayIndex(undefined);
                setTimeout(() => setSelectedReplayIndex(selectedReplayIndex + 1), 0);
              }
            : undefined
        }
        analyticsContext={analyticsContext}
        {...replayContext}
      />
      <ReplayTable
        onClickPlay={onClickPlay}
        replayPlayButtonPriority={isFinished || isPlaying ? 'primary' : 'default'}
        {...props}
      />
    </Fragment>
  );
}

export default ReplayTableWrapper;
