import replayerStepper from 'sentry/utils/replays/replayerStepper';
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

export default async function extactPageHtml({
  offsetMsToStopAt,
  rrwebEvents,
  startTimestampMs,
}: Args): Promise<[number, string][]> {
  const frames: ReplayFrame[] = offsetMsToStopAt.map(offsetMs => ({
    offsetMs,
    timestamp: new Date(startTimestampMs + offsetMs),
    timestampMs: startTimestampMs + offsetMs,
  })) as ReplayFrame[]; // TODO Don't smash types into `as ReplayFrame[]`, instead make the object really conform
  const results = await replayerStepper<ReplayFrame, string>({
    frames,
    rrwebEvents,
    startTimestampMs,
    shouldVisitFrame(_frame) {
      // Visit all the timestamps (converted to frames) that were passed in above
      return true;
    },
    onVisitFrame(frame, collection, replayer) {
      const doc = replayer.getMirror().getNode(1);
      const html = (doc as Document)?.body.outerHTML ?? '';
      collection.set(frame, html);
    },
  });
  return Array.from(results.entries()).map(([frame, html]) => {
    return [frame.offsetMs, html];
  });
}
