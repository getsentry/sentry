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
  replaySlug: string;
}

function ReplayClipPreview({
  analyticsContext,
  clipOffsets,
  eventTimestampMs,
  orgSlug,
  replaySlug,
  ...props
}: ReplayClipPreviewProps) {
  const clipWindow = useMemo(
    () => ({
      startTimestampMs: eventTimestampMs - clipOffsets.durationBeforeMs,
      endTimestampMs: eventTimestampMs + clipOffsets.durationAfterMs,
    }),
    [clipOffsets.durationBeforeMs, clipOffsets.durationAfterMs, eventTimestampMs]
  );

  const replayReaderResult = useLoadReplayReader({
    orgSlug,
    replaySlug,
    clipWindow,
  });

  const {fetching, replay} = replayReaderResult;

  return (
    <ReplayContextProvider
      analyticsContext={analyticsContext}
      isFetching={fetching}
      replay={replay}
    >
      <ReplayClipPreviewPlayer
        replayReaderResult={replayReaderResult}
        analyticsContext={analyticsContext}
        orgSlug={orgSlug}
        {...props}
      />
    </ReplayContextProvider>
  );
}
export default ReplayClipPreview;
