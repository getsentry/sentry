import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import type RRWebPlayer from 'rrweb-player';

import BaseRRWebReplayer from './baseRRWebReplayer';

type RRWebEvents = ConstructorParameters<typeof RRWebPlayer>[0]['props']['events'];
interface Props {
  urls: string[];
  className?: string;
}

function RRWebReplayer({urls}: Props) {
  const [events, setEvents] = useState<RRWebEvents>();

  const loadEvents = async () => {
    try {
      const data = await Promise.all(
        urls.map(async url => {
          const resp = await fetch(url);
          const json = await resp.json();

          return json.events;
        })
      );

      // `data` is Array<Array<RRWebEvent>> that we will want to flatten
      setEvents(data.flat());
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  useEffect(() => void loadEvents(), [urls]);

  return <BaseRRWebReplayer events={events} />;
}

export default RRWebReplayer;
