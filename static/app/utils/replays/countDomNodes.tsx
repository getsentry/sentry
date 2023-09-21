import {Replayer} from '@sentry-internal/rrweb';

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
  frames = [],
  rrwebEvents,
  startTimestampMs,
}: Args): Promise<DomNodeChartDatapoint[]> {
  return new Promise(resolve => {
    const datapoints = new Map<RecordingFrame, DomNodeChartDatapoint>();
    const player = createPlayer(rrwebEvents);

    const nextFrame = (function () {
      let i = 0;
      return () => frames[i++];
    })();

    const onDone = () => {
      resolve(Array.from(datapoints.values()));
    };

    const nextOrDone = () => {
      const next = nextFrame();
      if (next) {
        matchFrame(next);
      } else {
        onDone();
      }
    };

    type FrameRef = {
      frame: undefined | RecordingFrame;
    };

    const nodeIdRef: FrameRef = {
      frame: undefined,
    };

    const handlePause = () => {
      const frame = nodeIdRef.frame as RecordingFrame;
      const idCount = player.getMirror().getIds().length; // gets number of DOM nodes present
      datapoints.set(frame as RecordingFrame, {
        count: idCount,
        timestampMs: frame.timestamp,
        startTimestampMs: frame.timestamp,
        endTimestampMs: frame.timestamp,
      });
      nextOrDone();
    };

    const matchFrame = frame => {
      // reduce the number of frames we look at
      const shouldSample = Math.random() < 0.3;
      if (!shouldSample || !frame) {
        nextOrDone();
        return;
      }
      nodeIdRef.frame = frame;

      window.setTimeout(() => {
        player.pause(frame.timestamp - startTimestampMs);
      }, 0);
    };

    player.on('pause', handlePause);
    matchFrame(nextFrame());
  });
}

function createPlayer(rrwebEvents): Replayer {
  const domRoot = document.createElement('div');
  domRoot.className = 'sentry-block';
  const {style} = domRoot;

  style.position = 'fixed';
  style.inset = '0';
  style.width = '0';
  style.height = '0';
  style.overflow = 'hidden';

  document.body.appendChild(domRoot);

  const replayerRef = new Replayer(rrwebEvents, {
    root: domRoot,
    loadTimeout: 1,
    showWarning: false,
    blockClass: 'sentry-block',
    speed: 99999,
    skipInactive: true,
    triggerFocus: false,
    mouseTail: false,
  });
  return replayerRef;
}
