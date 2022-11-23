import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import first from 'lodash/first';
import {Replayer} from 'rrweb';
import {eventWithTime} from 'rrweb/typings/types';

import type {Crumb} from 'sentry/types/breadcrumbs';
import type ReplayReader from 'sentry/utils/replays/replayReader';

// Copied from `node_modules/rrweb/typings/types.d.ts`
enum EventType {
  DomContentLoaded = 0,
  Load = 1,
  FullSnapshot = 2,
  IncrementalSnapshot = 3,
  Meta = 4,
  Custom = 5,
  Plugin = 6,
}

export type Extraction = {
  crumb: Crumb;
  html: string;
  timestamp: number;
};

type HookOpts = {
  replay: ReplayReader;
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

function useExtractedCrumbHtml({replay}: HookOpts) {
  const [isLoading, setIsLoading] = useState(true);
  const [breadcrumbRefs, setBreadcrumbReferences] = useState<Extraction[]>([]);

  useEffect(() => {
    requestIdleCallback(
      () => {
        let isMounted = true;

        const domRoot = document.createElement('div');
        domRoot.className = 'sentry-block';
        const {style} = domRoot;
        style.position = 'fixed';
        style.inset = '0';
        style.width = '0';
        style.height = '0';
        style.overflow = 'hidden';

        document.body.appendChild(domRoot);

        // Get a list of the breadcrumbs that relate directly to the DOM, for each
        // crumb we will extract the referenced HTML.
        const crumbs = replay
          .getRawCrumbs()
          .filter(crumb => crumb.data && 'nodeId' in crumb.data);

        const rrwebEvents = replay.getRRWebEvents();

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
                if (isMounted) {
                  setBreadcrumbReferences(rows);
                }
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
          replayerRef.pause(replay.getReplay().finishedAt.getTime());
        } catch (error) {
          Sentry.captureException(error);
        }

        setIsLoading(false);

        return () => {
          isMounted = false;
        };
      },
      {
        timeout: 2500,
      }
    );
  }, [replay]);

  return {
    isLoading,
    actions: breadcrumbRefs,
  };
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

export default useExtractedCrumbHtml;
