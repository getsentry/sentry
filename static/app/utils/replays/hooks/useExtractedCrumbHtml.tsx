import {useEffect, useState} from 'react';
import first from 'lodash/first';
import {Replayer} from 'rrweb'; // , ReplayerEvents
import {eventWithTime} from 'rrweb/typings/types';

import type {Crumb} from 'sentry/types/breadcrumbs';
import type ReplayReader from 'sentry/utils/replays/replayReader';

const IncrementalSnapshot = 3;

type Extraction = {
  crumb: Crumb;
  html: string;
  timestamp: number;
};

type HookOpts = {
  domRoot: null | HTMLDivElement;
  replay: ReplayReader;
};
function useExtractedCrumbHtml({replay, domRoot}: HookOpts) {
  const [breadcrumbRefs, setBreadcrumbReferences] = useState<Extraction[]>([]);

  useEffect(() => {
    if (!domRoot) {
      setBreadcrumbReferences([]);
      return;
    }

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
          onFinish: setBreadcrumbReferences,
        }),
      ],
      mouseTail: false,
    });

    // Run the replay to the end, we will capture data as it streams into the plugin
    replayerRef.pause(replay.getEvent().endTimestamp);
  }, [domRoot, replay]);

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

  activites: Extraction[] = [];

  constructor({crumbs, isFinished, onFinish}: PluginOpts) {
    this.crumbs = crumbs;
    this.isFinished = isFinished;
    this.onFinish = onFinish;
  }

  handler(event: eventWithTime, _isSync: boolean, {replayer}: {replayer: Replayer}) {
    if (event.type === IncrementalSnapshot) {
      const crumb = first(this.crumbs);
      const nextTimestamp = +new Date(crumb?.timestamp || '');

      if (crumb && nextTimestamp && nextTimestamp < event.timestamp) {
        // we passed the next one, grab the dom, and pop the timestamp off
        const mirror = replayer.getMirror();
        // @ts-expect-error
        const node = mirror.getNode(crumb.data?.nodeId || '');
        // @ts-expect-error
        const html = node?.outerHTML || node?.textContent || '';

        this.activites.push({
          crumb,
          html,
          timestamp: nextTimestamp,
        });
        this.crumbs.shift();
      }
    }

    if (this.isFinished(event)) {
      this.onFinish(this.activites);
    }
  }
}

export default useExtractedCrumbHtml;
