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
  current: Frame | undefined;
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
      resolve({});
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
      current: undefined,
    };

    const activeCallbacks: {
      current: Record<string, CallbackArgs<Frame, CollectionData>>;
    } = {
      current: {},
    };

    const considerFrame = (frame: Frame) => {
      activeCallbacks.current = Object.fromEntries(
        Object.entries(visitFrameCallbacks).filter(([_, v]) => {
          return v.shouldVisitFrame(frame, replayer);
        })
      );
      // console.log(activeCallbacks.current);

      if (Object.values(activeCallbacks.current).length) {
        frameRef.current = frame;
        window.setTimeout(() => {
          const timestamp =
            'offsetMs' in frame ? frame.offsetMs : frame.timestamp - startTimestampMs;
          replayer.pause(timestamp);
        }, 0);
      } else {
        frameRef.current = undefined;
        nextOrDone();
      }
    };

    const handlePause = () => {
      // console.log(collection);
      Object.entries(activeCallbacks.current).forEach(([k, v]) => {
        v.onVisitFrame(frameRef.current!, collection[k], replayer);
      });
      nextOrDone();
    };

    replayer.on('pause', handlePause);
    considerFrame(nextFrame());
  });
}
