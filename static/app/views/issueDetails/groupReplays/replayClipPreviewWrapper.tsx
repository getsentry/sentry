import ReplayClipPreviewPlayer from 'sentry/components/events/eventReplay/replayClipPreviewPlayer';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import type {Group} from 'sentry/types/group';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import type {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  group: Group;
  orgSlug: string;
  pageLinks: string | null;
  replaySlug: string;
  replays: ReplayListRecord[] | undefined;
  selectedReplayIndex: number;
  setSelectedReplayIndex: (index: number) => void;
  visibleColumns: ReplayColumn[];
  overlayContent?: React.ReactNode;
};

export function ReplayClipPreviewWrapper(props: Props) {
  const {selectedReplayIndex} = props;
  const {analyticsContext} = useReplayContext();
  const replayReaderData = useLoadReplayReader({
    orgSlug: props.orgSlug,
    replaySlug: props.replaySlug,
    group: props.group,
  });

  return (
    <ReplayClipPreviewPlayer
      replayReaderResult={replayReaderData}
      overlayContent={props.overlayContent}
      orgSlug={props.orgSlug}
      showNextAndPrevious
      handleForwardClick={
        props.replays && selectedReplayIndex + 1 < props.replays.length
          ? () => {
              props.setSelectedReplayIndex(selectedReplayIndex + 1);
            }
          : undefined
      }
      handleBackClick={
        selectedReplayIndex > 0
          ? () => {
              props.setSelectedReplayIndex(selectedReplayIndex - 1);
            }
          : undefined
      }
      analyticsContext={analyticsContext}
      isLarge
    />
  );
}
