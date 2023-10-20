import replayerStepper from 'sentry/utils/replays/replayerStepper';
import type {RecordingFrame} from 'sentry/utils/replays/types';

export type DomNodeChartDatapoint = {
  count: number;
  endTimestampMs: number;
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

  return replayerStepper<RecordingFrame, DomNodeChartDatapoint>({
    frames,
    rrwebEvents,
    startTimestampMs,
    shouldVisitFrame: () => {
      frameCount++;
      return frameCount % frameStep === 0;
    },
    onVisitFrame: (frame, collection, replayer) => {
      const idCount = replayer.getMirror().getIds().length; // gets number of DOM nodes present
      collection.set(frame as RecordingFrame, {
        count: idCount,
        timestampMs: frame.timestamp,
        startTimestampMs: frame.timestamp,
        endTimestampMs: frame.timestamp,
      });
    },
  });
}
