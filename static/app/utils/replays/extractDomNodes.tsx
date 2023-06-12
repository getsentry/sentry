import * as Sentry from '@sentry/react';
import type {eventWithTime} from '@sentry-internal/rrweb';
import {EventType, Replayer} from '@sentry-internal/rrweb';
import first from 'lodash/first';

import type {Crumb} from 'sentry/types/breadcrumbs';

export type Extraction = {
  crumb: Crumb;
  html: string;
  timestamp: number;
};

type Args = {
  crumbs: Crumb[] | undefined;
  finishedAt: Date | undefined;
  rrwebEvents: eventWithTime[] | undefined;
};

const requestIdleCallback =
  window.requestIdleCallback ||
  function requestIdleCallbackPolyfill(cb) {
    const start = Date.now();
    return setTimeout(function () {
      cb({
        didTimeout: false,
        timeRemaining: function () {
          return Math.max(0, 50 - (Date.now() - start));
        },
      });
    }, 1);
  };

function _extractDomNodes({
  crumbs,
  rrwebEvents,
  finishedAt,
}: Args): Promise<Extraction[]> {
  // Get a list of the breadcrumbs that relate directly to the DOM, for each
  // crumb we will extract the referenced HTML.
  if (!crumbs || !rrwebEvents || rrwebEvents.length < 2 || !finishedAt) {
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

    const isLastRRWebEvent = (event: eventWithTime) => lastEvent === event;

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
          crumbs,
          isFinished: isLastRRWebEvent,
          onFinish: rows => {
            // if (isMounted) {
            resolve(rows);
            // }
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
  crumbs: Crumb[];
  isFinished: (event: eventWithTime) => boolean;
  onFinish: (mutations: Extraction[]) => void;
};

class BreadcrumbReferencesPlugin {
  crumbs: Crumb[];
  isFinished: (event: eventWithTime) => boolean;
  onFinish: (mutations: Extraction[]) => void;

  nextExtract: null | Extraction['html'] = null;
  activities: Extraction[] = [];

  constructor({crumbs, isFinished, onFinish}: PluginOpts) {
    this.crumbs = crumbs;
    this.isFinished = isFinished;
    this.onFinish = onFinish;
  }

  handler(event: eventWithTime, _isSync: boolean, {replayer}: {replayer: Replayer}) {
    if (event.type === EventType.FullSnapshot) {
      this.extractNextCrumb({replayer});
    } else if (event.type === EventType.IncrementalSnapshot) {
      this.extractCurrentCrumb(event, {replayer});
      this.extractNextCrumb({replayer});
    }

    if (this.isFinished(event)) {
      this.onFinish(this.activities);
    }
  }

  extractCurrentCrumb(event: eventWithTime, {replayer}: {replayer: Replayer}) {
    const crumb = first(this.crumbs);
    const crumbTimestamp = +new Date(crumb?.timestamp || '');

    if (!crumb || !crumbTimestamp || crumbTimestamp > event.timestamp) {
      return;
    }

    const truncated = extractNode(crumb, replayer) || this.nextExtract;
    if (truncated) {
      this.activities.push({
        crumb,
        html: truncated,
        timestamp: crumbTimestamp,
      });
    }

    this.nextExtract = null;
    this.crumbs.shift();
  }

  extractNextCrumb({replayer}: {replayer: Replayer}) {
    const crumb = first(this.crumbs);
    const crumbTimestamp = +new Date(crumb?.timestamp || '');

    if (!crumb || !crumbTimestamp) {
      return;
    }

    this.nextExtract = extractNode(crumb, replayer);
  }
}

function extractNode(crumb: Crumb, replayer: Replayer) {
  const mirror = replayer.getMirror();
  // @ts-expect-error
  const nodeId = crumb.data?.nodeId || '';
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

function removeNodesAtLevel(html: string, level: number) {
  const parser = new DOMParser();
  try {
    const doc = parser.parseFromString(html, 'text/html');

    const removeChildLevel = (
      max: number,
      collection: HTMLCollection,
      current: number = 0
    ) => {
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
    };

    removeChildLevel(level, doc.body.children);
    return doc.body.innerHTML;
  } catch (err) {
    // If we can't parse the HTML, just return the original
    return html;
  }
}
