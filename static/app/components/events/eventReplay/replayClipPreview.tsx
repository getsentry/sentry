import {useMemo} from 'react';

import ReplayClipPreviewPlayer from 'sentry/components/events/eventReplay/replayClipPreviewPlayer';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';

interface ReplayClipPreviewProps
  extends Omit<
    React.ComponentProps<typeof ReplayClipPreviewPlayer>,
    'replayReaderResult'
  > {
  clipOffsets: {
    durationAfterMs: number;
    durationBeforeMs: number;
  };
  eventTimestampMs: number;
  orgSlug: string;
  replaySlug: string;
}

export default function ReplayClipPreview({
  analyticsContext,
  clipOffsets,
  eventTimestampMs,
  orgSlug,
  replaySlug,
  fullReplayButtonProps,
}: ReplayClipPreviewProps) {
  const clipWindow = useMemo(
    () => ({
      startTimestampMs: eventTimestampMs - clipOffsets.durationBeforeMs,
      endTimestampMs: eventTimestampMs + clipOffsets.durationAfterMs,
    }),
    [clipOffsets.durationBeforeMs, clipOffsets.durationAfterMs, eventTimestampMs]
  );

  const readerResult = useLoadReplayReader({
    orgSlug,
    replaySlug,
    clipWindow,
    eventTimestampMs,
  });

  const {fetching, replay} = readerResult;

  return (
    <ReplayContextProvider
      analyticsContext={analyticsContext}
      isFetching={fetching}
      replay={replay}
    >
      <ReplayClipPreviewPlayer
        replayReaderResult={readerResult}
        analyticsContext={analyticsContext}
        fullReplayButtonProps={fullReplayButtonProps}
      />
    </ReplayContextProvider>
  );
}
