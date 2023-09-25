import {Replayer} from '@sentry-internal/rrweb';
import type {Mirror} from '@sentry-internal/rrweb-snapshot';

import type {RecordingFrame, ReplayFrame} from 'sentry/utils/replays/types';

export type Extraction = {
  frame: ReplayFrame;
  html: string | null;
  timestamp: number;
};

type Args = {
  frames: ReplayFrame[] | undefined;
  rrwebEvents: RecordingFrame[] | undefined;
};

export default function extractDomNodes({
  frames = [],
  rrwebEvents,
}: Args): Promise<Extraction[]> {
  return new Promise(resolve => {
    if (!frames.length) {
      resolve([]);
      return;
    }

    const extractions = new Map<ReplayFrame, Extraction>();

    const player = createPlayer(rrwebEvents);
    const mirror = player.getMirror();

    const nextFrame = (function () {
      let i = 0;
      return () => frames[i++];
    })();

    const onDone = () => {
      resolve(Array.from(extractions.values()));
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
      const nodeId = nodeIdRef.nodeId as number;

      const html = extractHtml(nodeId as number, mirror);
      extractions.set(frame as ReplayFrame, {
        frame,
        html,
        timestamp: frame.timestampMs,
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

function extractHtml(nodeId: number, mirror: Mirror): string | null {
  const node = mirror.getNode(nodeId);

  const html =
    (node && 'outerHTML' in node ? (node.outerHTML as string) : node?.textContent) || '';
  // Limit document node depth to 2
  let truncated = removeNodesAtLevel(html, 2);
  // If still very long and/or removeNodesAtLevel failed, truncate
  if (truncated.length > 1500) {
    truncated = truncated.substring(0, 1500);
  }
  return truncated ? truncated : null;
}

function removeChildLevel(max: number, collection: HTMLCollection, current: number = 0) {
  for (let i = 0; i < collection.length; i++) {
    const child = collection[i];
    if (child.nodeName === 'STYLE') {
      child.textContent = '/* Inline CSS */';
    }
    if (child.nodeName === 'svg') {
      child.innerHTML = '<!-- SVG -->';
    }
    if (max <= current) {
      if (child.childElementCount > 0) {
        child.innerHTML = `<!-- ${child.childElementCount} descendents -->`;
      }
    } else {
      removeChildLevel(max, child.children, current + 1);
    }
  }
}

function removeNodesAtLevel(html: string, level: number): string {
  const parser = new DOMParser();

  try {
    const doc = parser.parseFromString(html, 'text/html');
    removeChildLevel(level, doc.body.children);
    return doc.body.innerHTML;
  } catch (err) {
    // If we can't parse the HTML, just return the original
    return html;
  }
}
