import {Replayer} from '@sentry-internal/rrweb';

import type {RecordingFrame, ReplayFrame} from 'sentry/utils/replays/types';

export type DomNodeChartDatapoint = {
  count: number;
  endTimestampMs: number;
  startTimestampMs: number;
  timestampMs: number;
};

type Args = {
  frames: ReplayFrame[] | undefined;
  rrwebEvents: RecordingFrame[] | undefined;
};

export default function countNomNodes({
  frames = [],
  rrwebEvents,
}: Args): Promise<DomNodeChartDatapoint[]> {
  return new Promise(resolve => {
    if (!frames.length) {
      resolve([]);
      return;
    }

    const datapoints = new Map<ReplayFrame, DomNodeChartDatapoint>();

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
      frame: undefined | ReplayFrame;
      nodeId: undefined | number;
    };

    const nodeIdRef: FrameRef = {
      frame: undefined,
      nodeId: undefined,
    };

    const handlePause = () => {
      if (!nodeIdRef.nodeId && !nodeIdRef.frame) {
        return;
      }
      const frame = nodeIdRef.frame as ReplayFrame;
      const count = countDomNodes();
      datapoints.set(frame as ReplayFrame, {
        count,
        timestampMs: frame.timestampMs,
        startTimestampMs: frame.timestampMs,
        endTimestampMs: frame.timestampMs,
      });
      nextOrDone();
    };

    const matchFrame = frame => {
      nodeIdRef.frame = frame;
      nodeIdRef.nodeId =
        frame.data && 'nodeId' in frame.data ? frame.data.nodeId : undefined;

      if (nodeIdRef.nodeId === undefined || nodeIdRef.nodeId === -1) {
        nextOrDone();
        return;
      }

      window.setTimeout(() => {
        player.pause(frame.offsetMs);
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

function countDomNodes(): number {
  // const count = document.querySelectorAll('*').length;
  const count = document.getElementsByTagName('*').length;
  return count;
}
