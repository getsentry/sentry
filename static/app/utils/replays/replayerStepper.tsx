import type {Replayer} from '@sentry-internal/rrweb';

import type {RecordingFrame, ReplayFrame} from 'sentry/utils/replays/types';

import {createHiddenPlayer} from './createHiddenPlayer';

interface Args<Frame extends ReplayFrame | RecordingFrame, CollectionData> {
  frames: Frame[] | undefined;
  onVisitFrame: (
    frame: Frame,
    collection: Map<Frame, CollectionData>,
    replayer: Replayer
  ) => void;
  rrwebEvents: RecordingFrame[] | undefined;
  shouldVisitFrame: (frame: Frame, replayer: Replayer) => boolean;
  startTimestampMs: number;
}

type FrameRef<Frame extends ReplayFrame | RecordingFrame> = {
  frame: Frame | undefined;
};

export default function replayerStepper<
  Frame extends ReplayFrame | RecordingFrame,
  CollectionData,
>({
  frames,
  onVisitFrame,
  rrwebEvents,
  shouldVisitFrame,
  startTimestampMs,
}: Args<Frame, CollectionData>): Promise<Map<Frame, CollectionData>> {
  const collection = new Map<Frame, CollectionData>();

  return new Promise(resolve => {
    if (!frames?.length || !rrwebEvents?.length) {
      resolve(new Map());
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
      if (shouldVisitFrame(frame, replayer)) {
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
    };

    const handlePause = () => {
      onVisitFrame(frameRef.frame!, collection, replayer);
      nextOrDone();
    };

    replayer.on('pause', handlePause);
    considerFrame(nextFrame());
  });
}
