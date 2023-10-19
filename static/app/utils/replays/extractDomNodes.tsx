import type {Mirror} from '@sentry-internal/rrweb-snapshot';

import replayerStepper from 'sentry/utils/replays/replayerStepper';
import {
  getNodeId,
  type RecordingFrame,
  type ReplayFrame,
} from 'sentry/utils/replays/types';

export type Extraction = {
  frame: ReplayFrame;
  html: string | null;
  timestamp: number;
};

type Args = {
  frames: ReplayFrame[] | undefined;
  rrwebEvents: RecordingFrame[] | undefined;
  startTimestampMs: number;
};

export default function extractDomNodes({
  frames,
  rrwebEvents,
  startTimestampMs,
}: Args): Promise<Map<ReplayFrame, Extraction>> {
  return replayerStepper({
    frames,
    rrwebEvents,
    startTimestampMs,
    shouldVisitFrame: frame => {
      const nodeId = getNodeId(frame);
      return nodeId !== undefined && nodeId !== -1;
    },
    onVisitFrame: (frame, collection, replayer) => {
      const mirror = replayer.getMirror();
      const nodeId = getNodeId(frame);
      const html = extractHtml(nodeId as number, mirror);
      collection.set(frame as ReplayFrame, {
        frame,
        html,
        timestamp: frame.timestampMs,
      });
    },
  });
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
