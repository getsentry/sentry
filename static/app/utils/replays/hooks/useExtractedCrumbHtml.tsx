import {useEffect, useState} from 'react';
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

type Extraction = {
  crumb: Crumb;
  html: string;
  timestamp: number;
};

type HookOpts = {
  replay: ReplayReader;
};
function useExtractedCrumbHtml({replay}: HookOpts) {
  const [breadcrumbRefs, setBreadcrumbReferences] = useState<Extraction[]>([]);

  useEffect(() => {
    let isMounted = true;

    const domRoot = document.createElement('div');
    domRoot.className = 'sr-block';
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
    const lastTimestamp = lastEvent.timestamp;

    const isLastRRWebEvent = (event: eventWithTime) => lastTimestamp === event.timestamp;

    const replayerRef = new Replayer(rrwebEvents, {
      root: domRoot,
      loadTimeout: 1,
      showWarning: false,
      blockClass: 'sr-block',
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
            document.body.removeChild(domRoot);
          },
        }),
      ],
      mouseTail: false,
    });

    // Run the replay to the end, we will capture data as it streams into the plugin
    replayerRef.pause(replay.getEvent().endTimestamp);

    return () => {
      isMounted = false;
    };
  }, [replay]);

  return {
    isLoading: false,
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

  activities: Extraction[] = [];

  constructor({crumbs, isFinished, onFinish}: PluginOpts) {
    this.crumbs = crumbs;
    this.isFinished = isFinished;
    this.onFinish = onFinish;
  }

  handler(event: eventWithTime, _isSync: boolean, {replayer}: {replayer: Replayer}) {
    if (event.type === EventType.IncrementalSnapshot) {
      const crumb = first(this.crumbs);
      const nextTimestamp = +new Date(crumb?.timestamp || '');

      if (crumb && nextTimestamp && nextTimestamp < event.timestamp) {
        // we passed the next one, grab the dom, and pop the timestamp off
        const mirror = replayer.getMirror();
        // @ts-expect-error
        const node = mirror.getNode(crumb.data?.nodeId || '');
        // @ts-expect-error
        const html = node?.outerHTML || node?.textContent || '';

        this.activities.push({
          crumb,
          html,
          timestamp: nextTimestamp,
        });
        this.crumbs.shift();
      }
    }

    if (this.isFinished(event)) {
      this.onFinish(this.activities);
    }
  }
}

export default useExtractedCrumbHtml;
