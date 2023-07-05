import * as Sentry from '@sentry/react';
import {Replayer} from '@sentry-internal/rrweb';
import first from 'lodash/first';

import type {
  BreadcrumbFrame,
  RecordingFrame,
  SpanFrame,
} from 'sentry/utils/replays/types';
import {EventType} from 'sentry/utils/replays/types';
import requestIdleCallback from 'sentry/utils/window/requestIdleCallback';

export type Extraction = {
  frame: BreadcrumbFrame | SpanFrame;
  html: string;
  timestamp: number;
};

type Args = {
  finishedAt: Date | undefined;
  frames: (BreadcrumbFrame | SpanFrame)[] | undefined;
  rrwebEvents: RecordingFrame[] | undefined;
};

function _extractDomNodes({
  frames,
  rrwebEvents,
  finishedAt,
}: Args): Promise<Extraction[]> {
  // Get a list of the BreadcrumbFrames that relate directly to the DOM, for each
  // frame we will extract the referenced HTML.
  if (!frames || !rrwebEvents || rrwebEvents.length < 2 || !finishedAt) {
    return Promise.reject();
  }

  return new Promise((resolve, reject) => {
    const domRoot = document.createElement('div');
    domRoot.className = 'sentry-block';
    const {style} = domRoot;
    style.position = 'fixed';
    style.inset = '0';
    style.width = '0';
    style.height = '0';
    style.overflow = 'hidden';

    document.body.appendChild(domRoot);

    // Grab the last event, but skip the synthetic `replay-end` event that the
    // ReplayerReader added. RRWeb will skip that event when it comes time to render
    const lastEvent = rrwebEvents[rrwebEvents.length - 2];

    const isLastRRWebEvent = (event: RecordingFrame) => lastEvent === event;

    const replayerRef = new Replayer(rrwebEvents, {
      root: domRoot,
      loadTimeout: 1,
      showWarning: false,
      blockClass: 'sentry-block',
      speed: 99999,
      skipInactive: true,
      triggerFocus: false,
      plugins: [
        new BreadcrumbReferencesPlugin({
          frames,
          isFinished: isLastRRWebEvent,
          onFinish: rows => {
            resolve(rows);
            setTimeout(() => {
              if (document.body.contains(domRoot)) {
                document.body.removeChild(domRoot);
              }
            }, 0);
          },
        }),
      ],
      mouseTail: false,
    });

    try {
      // Run the replay to the end, we will capture data as it streams into the plugin
      replayerRef.pause(finishedAt.getTime());
    } catch (error) {
      Sentry.captureException(error);
      reject(error);
    }
  });
}

export default function extractDomNodes(args: Args): Promise<Extraction[]> {
  return new Promise((resolve, reject) => {
    requestIdleCallback(
      () => {
        _extractDomNodes(args).then(resolve).catch(reject);
      },
      {
        timeout: 2500,
      }
    );
  });
}

type PluginOpts = {
  frames: (BreadcrumbFrame | SpanFrame)[];
  isFinished: (event: RecordingFrame) => boolean;
  onFinish: (mutations: Extraction[]) => void;
};

class BreadcrumbReferencesPlugin {
  frames: (BreadcrumbFrame | SpanFrame)[];
  isFinished: (event: RecordingFrame) => boolean;
  onFinish: (mutations: Extraction[]) => void;

  nextExtract: null | Extraction['html'] = null;
  activities: Extraction[] = [];

  constructor({frames, isFinished, onFinish}: PluginOpts) {
    this.frames = frames;
    this.isFinished = isFinished;
    this.onFinish = onFinish;
  }

  handler(event: RecordingFrame, _isSync: boolean, {replayer}: {replayer: Replayer}) {
    if (event.type === EventType.FullSnapshot) {
      this.extractNextFrame({replayer});
    } else if (event.type === EventType.IncrementalSnapshot) {
      this.extractCurrentFrame(event, {replayer});
      this.extractNextFrame({replayer});
    }

    if (this.isFinished(event)) {
      this.onFinish(this.activities);
    }
  }

  extractCurrentFrame(event: RecordingFrame, {replayer}: {replayer: Replayer}) {
    const frame = first(this.frames);

    if (!frame || !frame?.timestampMs || frame.timestampMs > event.timestamp) {
      return;
    }

    const truncated = extractNode(frame, replayer) || this.nextExtract;
    if (truncated) {
      this.activities.push({
        frame,
        html: truncated,
        timestamp: frame.timestampMs,
      });
    }

    this.nextExtract = null;
    this.frames.shift();
  }

  extractNextFrame({replayer}: {replayer: Replayer}) {
    const frame = first(this.frames);

    if (!frame || !frame?.timestampMs) {
      return;
    }

    this.nextExtract = extractNode(frame, replayer);
  }
}

function extractNode(frame: BreadcrumbFrame | SpanFrame, replayer: Replayer) {
  const mirror = replayer.getMirror();
  // @ts-expect-error
  const nodeId = (frame.data?.nodeId ?? -1) as number;
  const node = mirror.getNode(nodeId);
  // @ts-expect-error
  const html = node?.outerHTML || node?.textContent || '';

  // Limit document node depth to 2
  let truncated = removeNodesAtLevel(html, 2);
  // If still very long and/or removeNodesAtLevel failed, truncate
  if (truncated.length > 1500) {
    truncated = truncated.substring(0, 1500);
  }
  return truncated;
}

function removeChildLevel(max: number, collection: HTMLCollection, current: number = 0) {
  for (let i = 0; i < collection.length; i++) {
    const child = collection[i]!;

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

function removeNodesAtLevel(html: string, level: number) {
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
