import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import type RRWebPlayer from 'rrweb-player';

import {Event} from 'sentry/types/event';

import BaseRRWebReplayer from './baseRRWebReplayer';
import ReplayRRWebReplayer from './replayRRWebReplayer';

type RRWebEvents = ConstructorParameters<typeof RRWebPlayer>[0]['props']['events'];
interface Props {
  event: Event;
  urls: string[];
  className?: string;
  replayVersion?: boolean;
}

/**
 * Downloads a list of replay JSONs, merges the resulting events within the
 * JSON and passes it to the replayer.
 */
function RRWebReplayer({event, urls, replayVersion}: Props) {
  const [events, setEvents] = useState<RRWebEvents>();

  const loadEvents = async () => {
    try {
      // rrweb's recordings consist of:
      // 1) "checkout" phase that essentially records the entire DOM
      // 2) incremental updates (DOM changes/events)
      //
      // The "checkout" phase can be configured to happen at a time interval or
      // an event interval. We want to support SDK clients that record a
      // single, large JSON, but also clients that record the checkout and
      // incremental updates in separate JSON files.
      //
      // Below we download all of the JSON files and merge them into a large
      // list of events for the replayer. The replayer supports having a
      // list that has multiple "checkouts".
      const data: RRWebEvents[] = await Promise.all(
        urls.map(async url => {
          const resp = await fetch(url);
          const json = await resp.json();

          return json.events;
        })
      );

      setEvents(data.flat());
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  useEffect(() => void loadEvents(), [urls]); // eslint-disable-line react-hooks/exhaustive-deps

  if (replayVersion) {
    return <ReplayRRWebReplayer event={event} events={events} />;
  }
  return <BaseRRWebReplayer events={events} />;
}

export default RRWebReplayer;
