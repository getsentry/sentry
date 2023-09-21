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
    // if (!frames.length) {
    //   resolve([]);
    //   return;
    // }

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
      // nodeId: undefined | number;
    };

    const nodeIdRef: FrameRef = {
      frame: undefined,
      // nodeId: undefined,
    };

    const handlePause = () => {
      // if (!nodeIdRef.nodeId && !nodeIdRef.frame) {
      //   return;
      // }
      const frame = nodeIdRef.frame as RecordingFrame;
      // const count = countDomNodes();
      // const iframe = document.getElementsByTagName('iframe')[0];
      // const innerDoc = iframe.contentDocument;
      // const nodeCount = innerDoc?.getElementsByTagName('*').length ?? 0;
      const idCount = player.getMirror().getIds().length;
      datapoints.set(frame as RecordingFrame, {
        count: idCount,
        timestampMs: frame.timestamp,
        startTimestampMs: frame.timestamp,
        endTimestampMs: frame.timestamp,
      });
      nextOrDone();
    };

    const matchFrame = frame => {
      // nodeIdRef.nodeId =
      //   frame.data && 'nodeId' in frame.data ? frame.data.nodeId : undefined;
      const shouldSample = Math.random() < 0.1;
      if (!shouldSample || !frame) {
        nextOrDone();
        return;
      }
      nodeIdRef.frame = frame;
      // if (nodeIdRef.nodeId === undefined || nodeIdRef.nodeId === -1) {
      //   nextOrDone();
      //   return;
      // }

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

// function countDomNodes(): number {
//   const iframe = document.getElementsByTagName('iframe')[0];
//   const innerDoc = iframe.contentDocument;
//   const count = innerDoc?.getElementsByTagName('*').length ?? 0;
//   return count;
// }
