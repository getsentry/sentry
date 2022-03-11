import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import type RRWebPlayer from 'rrweb-player';

import BaseRRWebReplayer from './baseRRWebReplayer';

type RRWebEvents = ConstructorParameters<typeof RRWebPlayer>[0]['props']['events'];
interface Props {
  urls: string[];
  className?: string;
}

/**
 * Downloads a list of replay JSONs, merges the resulting events within the JSON and passes it to the replayer.
 */
function RRWebReplayer({urls}: Props) {
  const [events, setEvents] = useState<RRWebEvents>();

  const loadEvents = async () => {
    try {
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

  useEffect(() => void loadEvents(), [urls]);

  return <BaseRRWebReplayer events={events} />;
}

export default RRWebReplayer;
