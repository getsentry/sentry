import {Fragment} from 'react';

import ReplayClipPreviewPlayer from 'sentry/components/events/eventReplay/replayClipPreviewPlayer';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import type {Group} from 'sentry/types';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import ReplayTable from 'sentry/views/replays/replayTable';
import type {ReplayColumn} from 'sentry/views/replays/replayTable/types';

type Props = {
  group: Group;
  orgSlug: string;
  pageLinks: string | null;
  replaySlug: string;
  selectedReplayIndex: number;
  setSelectedReplayIndex: (index: number) => void;
  visibleColumns: ReplayColumn[];
  nextReplayText?: string;
} & React.ComponentProps<typeof ReplayTable>;

function ReplayTableWrapper({
  replaySlug,
  nextReplayText,
  setSelectedReplayIndex,
  orgSlug,
  group,
  ...props
}: Props) {
  const {selectedReplayIndex} = props;
  const {analyticsContext} = useReplayContext();
  const replayReaderData = useReplayReader({
    orgSlug,
    replaySlug,
    group,
  });

  return (
    <Fragment>
      <ReplayClipPreviewPlayer
        overlayText={nextReplayText}
        orgSlug={orgSlug}
        showNextAndPrevious
        handleForwardClick={
          props.replays && selectedReplayIndex + 1 < props.replays.length
            ? () => {
                setSelectedReplayIndex(selectedReplayIndex + 1);
              }
            : undefined
        }
        handleBackClick={
          selectedReplayIndex > 0
            ? () => {
                setSelectedReplayIndex(selectedReplayIndex - 1);
              }
            : undefined
        }
        onClickNextReplay={
          nextReplayText
            ? () => {
                setSelectedReplayIndex(selectedReplayIndex + 1);
              }
            : undefined
        }
        analyticsContext={analyticsContext}
        isLarge
        {...replayReaderData}
      />
      <ReplayTable
        onClickPlay={setSelectedReplayIndex}
        fetchError={props.fetchError}
        isFetching={props.isFetching}
        replays={props.replays}
        sort={props.sort}
        visibleColumns={props.visibleColumns}
      />
    </Fragment>
  );
}

export default ReplayTableWrapper;
