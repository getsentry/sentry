import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import RRWebPlayer from 'rrweb-player';

type Props = {
  url: string;
  className?: string;
};

type RRwebEvents = ConstructorParameters<typeof RRWebPlayer>[0]['props']['events'];

const BaseRRWebReplayer = ({url, className}: Props) => {
  const [playerEl, setPlayerEl] = useState<HTMLDivElement | null>(null);
  const [events, setEvents] = useState<RRwebEvents>();

  const loadEvents = async () => {
    try {
      const resp = await fetch(url);
      const data = await resp.json();

      setEvents(data.events);
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  useEffect(() => void loadEvents(), [url]);

  const initPlayer = () => {
    if (events === undefined) {
      return;
    }

    if (playerEl === null) {
      return;
    }

    // eslint-disable-next-line no-new
    new RRWebPlayer({
      target: playerEl,
      props: {events, autoPlay: false},
    });
  };

  useEffect(() => void initPlayer(), [events, playerEl]);

  return <div ref={el => setPlayerEl(el)} className={className} />;
};

export default BaseRRWebReplayer;
