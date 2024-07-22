import replayerStepper from 'sentry/utils/replays/replayerStepper';
import type {RecordingFrame} from 'sentry/utils/replays/types';

export type DomNodeChartDatapoint = {
  added: number;
  count: number;
  endTimestampMs: number;
  removed: number;
  startTimestampMs: number;
  timestampMs: number;
};

type Args = {
  frames: RecordingFrame[] | undefined;
  rrwebEvents: RecordingFrame[] | undefined;
  startTimestampMs: number;
};

export default function countDomNodes({
  frames,
  rrwebEvents,
  startTimestampMs,
}: Args): Promise<Map<RecordingFrame, DomNodeChartDatapoint>> {
  let frameCount = 0;
  const length = frames?.length ?? 0;
  const frameStep = Math.max(Math.round(length * 0.007), 1);

  let prevIds: number[] = [];

  return replayerStepper<RecordingFrame, DomNodeChartDatapoint>({
    frames,
    rrwebEvents,
    startTimestampMs,
    shouldVisitFrame: () => {
      frameCount++;
      return frameCount % frameStep === 0;
    },
    onVisitFrame: (frame, collection, replayer) => {
      const ids = replayer.getMirror().getIds(); // gets list of DOM nodes present
      const count = ids.length;
      const added = ids.filter(id => !prevIds.includes(id)).length;
      const removed = prevIds.filter(id => !ids.includes(id)).length;
      collection.set(frame as RecordingFrame, {
        count,
        added,
        removed,
        timestampMs: frame.timestamp,
        startTimestampMs: frame.timestamp,
        endTimestampMs: frame.timestamp,
      });
      prevIds = ids;
    },
  });
}
