import {Replayer} from '@sentry-internal/rrweb';

import type {
  BreadcrumbFrame,
  RecordingFrame,
  SpanFrame,
} from 'sentry/utils/replays/types';

export type Extraction = {
  frame: BreadcrumbFrame | SpanFrame;
  html: string | null;
  timestamp: number;
};

type Args = {
  frames: (BreadcrumbFrame | SpanFrame)[] | undefined;
  rrwebEvents: RecordingFrame[] | undefined;
};

export default function extractDomNodes({
  frames = [],
  rrwebEvents,
}: Args): Promise<Extraction[]> {
  return new Promise(resolve => {
    const extractions = new Map<BreadcrumbFrame | SpanFrame, Extraction>();
    frames.forEach(frame =>
      extractions.set(frame, {
        frame,
        html: null,
        timestamp: frame.timestampMs,
      })
    );

    const player = createPlayer(rrwebEvents);
    let lastEventTimestamp = 0;

    const callback = event => {
      if (event.type === 2 || event.type === 3) {
        // Get first frame with a timestamp less than the last seen event timestamp
        const firstFrameAfterEvent = frames.findIndex(
          frame => frame.timestampMs >= lastEventTimestamp
        );

        lastEventTimestamp = event.timestamp;

        for (let i = firstFrameAfterEvent; i < frames.length; i++) {
          const frame = frames[i];

          // Sometimes frames have nodeId -1 so we ignore these
          if (frame.data && 'nodeId' in frame.data && frame.data.nodeId === -1) {
            continue;
          }

          // If we found the frame.data.nodeId inside the player at this timestamp, push it to the DOM events list
          const found = extractNode(frame, player);
          if (found) {
            extractions.set(frame, found);
          }
          continue;
        }
      }

      // Check if we've finished looking at all events
      // If so, return the resolved promise
      const meta = player.getMetaData();
      const percent = player.getCurrentTime() / meta.totalTime;
      if (percent >= 1) {
        resolve([...extractions.values()]);
      }
    };

    player.on('event-cast', callback);
    window.setTimeout(() => player.play(0), 0);
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

function extractNode(
  frame: BreadcrumbFrame | SpanFrame,
  replayer: Replayer
): Extraction | null {
  const mirror = replayer.getMirror();
  const nodeId = frame.data && 'nodeId' in frame.data ? frame.data.nodeId : -1;
  const node = mirror.getNode(nodeId);
  const html =
    (node && 'outerHTML' in node ? (node.outerHTML as string) : node?.textContent) || '';
  // Limit document node depth to 2
  let truncated = removeNodesAtLevel(html, 2);
  // If still very long and/or removeNodesAtLevel failed, truncate
  if (truncated.length > 1500) {
    truncated = truncated.substring(0, 1500);
  }
  if (!truncated) {
    return null;
  }
  return {
    frame,
    html: truncated,
    timestamp: frame.timestampMs,
  };
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
