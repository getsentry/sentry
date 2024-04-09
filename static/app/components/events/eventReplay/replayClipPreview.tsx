import {useMemo} from 'react';

import ReplayClipPreviewPlayer from 'sentry/components/events/eventReplay/replayClipPreviewPlayer';
import {StaticReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';

type Props = {
  clipOffsets: {
    durationAfterMs: number;
    durationBeforeMs: number;
  };
  eventTimestampMs: number;
  replaySlug: string;
} & Omit<
  React.ComponentProps<typeof ReplayClipPreviewPlayer>,
  keyof ReturnType<typeof useReplayReader>
>;

function ReplayClipPreview({
  analyticsContext,
  clipOffsets,
  eventTimestampMs,
  orgSlug,
  replaySlug,
  ...props
}: Props) {
  const clipWindow = useMemo(
    () => ({
      startTimestampMs: eventTimestampMs - clipOffsets.durationBeforeMs,
      endTimestampMs: eventTimestampMs + clipOffsets.durationAfterMs,
    }),
    [clipOffsets.durationBeforeMs, clipOffsets.durationAfterMs, eventTimestampMs]
  );

  const replayContext = useReplayReader({
    orgSlug,
    replaySlug,
    clipWindow,
  });

  const {fetching, replay} = replayContext;

  return (
    <ReplayContextProvider
      analyticsContext={analyticsContext}
      isFetching={fetching}
      prefsStrategy={StaticReplayPreferences}
      replay={replay}
    >
      <ReplayClipPreviewPlayer
        analyticsContext={analyticsContext}
        orgSlug={orgSlug}
        {...props}
        {...replayContext}
      />
    </ReplayContextProvider>
  );
}
export default ReplayClipPreview;
