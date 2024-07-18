import type {Replayer} from '@sentry-internal/rrweb';

import type {RecordingFrame, ReplayFrame} from 'sentry/utils/replays/types';

import {createHiddenPlayer} from './createHiddenPlayer';

type OnVisitFrameType<Frame extends ReplayFrame | RecordingFrame, CollectionData> = (
  frame: Frame,
  collection: Map<Frame, CollectionData>,
  replayer: Replayer
) => void;

type ShouldVisitFrameType<Frame extends ReplayFrame | RecordingFrame> = (
  frame: Frame,
  replayer: Replayer
) => boolean;

type CallbackArgs<Frame extends ReplayFrame | RecordingFrame, CollectionData> = {
  onVisitFrame: OnVisitFrameType<Frame, CollectionData>;
  shouldVisitFrame: ShouldVisitFrameType<Frame>;
};

interface Args<Frame extends ReplayFrame | RecordingFrame, CollectionData> {
  frames: Frame[] | undefined;
  rrwebEvents: RecordingFrame[] | undefined;
  startTimestampMs: number;
  visitFrameCallbacks: Record<string, CallbackArgs<Frame, CollectionData>>;
}

type FrameRef<Frame extends ReplayFrame | RecordingFrame> = {
  frame: Frame | undefined;
};

export default function replayerStepper<
  Frame extends ReplayFrame | RecordingFrame,
  CollectionData,
>({
  frames,
  rrwebEvents,
  visitFrameCallbacks,
  startTimestampMs,
}: Args<Frame, CollectionData>): Promise<Record<string, Map<Frame, CollectionData>>> {
  const collection = {};
  Object.keys(visitFrameCallbacks).forEach(
    k => (collection[k] = new Map<Frame, CollectionData>())
  );

  return new Promise(resolve => {
    if (!frames?.length || !rrwebEvents?.length) {
      resolve({result: new Map()});
      return;
    }

    const {replayer, cleanupReplayer} = createHiddenPlayer(rrwebEvents);

    const nextFrame = (function () {
      let i = 0;
      return () => frames[i++];
    })();

    const onDone = () => {
      resolve(collection);
      // to avoid recursion, since destroy() in cleanupReplayer() calls pause()
      replayer.off('pause', handlePause);
      cleanupReplayer();
    };

    const nextOrDone = () => {
      const next = nextFrame();
      if (next) {
        considerFrame(next);
      } else {
        onDone();
      }
    };

    const frameRef: FrameRef<Frame> = {
      frame: undefined,
    };

    const considerFrame = (frame: Frame) => {
      Object.values(visitFrameCallbacks).forEach(v => {
        if (v.shouldVisitFrame(frame, replayer)) {
          frameRef.frame = frame;
          window.setTimeout(() => {
            const timestamp =
              'offsetMs' in frame ? frame.offsetMs : frame.timestamp - startTimestampMs;
            replayer.pause(timestamp);
          }, 0);
        } else {
          frameRef.frame = undefined;
          nextOrDone();
        }
      });
    };

    const handlePause = () => {
      Object.entries(visitFrameCallbacks).forEach(([k, v]) => {
        v.onVisitFrame(frameRef.frame!, collection[k], replayer);
        nextOrDone();
      });
    };

    replayer.on('pause', handlePause);
    considerFrame(nextFrame());
  });
}
