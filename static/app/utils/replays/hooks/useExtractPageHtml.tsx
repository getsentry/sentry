import {useQuery} from 'sentry/utils/queryClient';
import replayerStepper from 'sentry/utils/replays/replayerStepper';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {RecordingFrame, ReplayFrame} from 'sentry/utils/replays/types';

type Args = {
  /**
   * Offsets where we should stop and take a snapshot of the rendered HTML
   */
  offsetMsToStopAt: number[];

  /**
   * The rrweb events that constitute the replay
   */
  rrwebEvents: RecordingFrame[] | undefined;

  /**
   * The replay startTimestampMs
   */
  startTimestampMs: number;
};

async function extractPageHtml({
  offsetMsToStopAt,
  rrwebEvents,
  startTimestampMs,
}: Args): Promise<Array<[number, string]>> {
  const frames: ReplayFrame[] = offsetMsToStopAt.map(offsetMs => ({
    offsetMs,
    timestamp: new Date(startTimestampMs + offsetMs),
    timestampMs: startTimestampMs + offsetMs,
  })) as ReplayFrame[]; // TODO Don't smash types into `as ReplayFrame[]`, instead make the object really conform
  const results = await replayerStepper<ReplayFrame, string>({
    frames,
    rrwebEvents,
    startTimestampMs,
    shouldVisitFrame: () => {
      // Visit all the timestamps (converted to frames) that were passed in above
      return true;
    },
    onVisitFrame: (frame, collection, replayer) => {
      const doc = replayer.getMirror().getNode(1);
      const html = (doc as Document)?.body.outerHTML ?? '';
      collection.set(frame, html);
    },
  });
  return Array.from(results.entries()).map(([frame, html]) => {
    return [frame.offsetMs, html];
  });
}

interface Props {
  offsetMsToStopAt: number[];
  replay: ReplayReader | null;
}

export default function useExtractPageHtml({replay, offsetMsToStopAt}: Props) {
  return useQuery({
    queryKey: ['extractPageHtml', replay, offsetMsToStopAt],
    queryFn: () =>
      extractPageHtml({
        offsetMsToStopAt,
        rrwebEvents: replay?.getRRWebFrames(),
        startTimestampMs: replay?.getReplay().started_at.getTime() ?? 0,
      }),
    enabled: Boolean(replay),
    gcTime: Infinity,
  });
}
