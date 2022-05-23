import {useCallback, useEffect, useRef} from 'react';

import type {ReplayPlayerContextProps} from 'sentry/components/replays/replayContext';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import type {EventTransaction} from 'sentry/types/event';

type Options = {
  childWindow: Window | null;
};

type ReplayStateChange = {
  payload: {
    currentHoverTime: ReplayPlayerContextProps['currentHoverTime'];
    currentTime: ReplayPlayerContextProps['currentTime'];
    eventId: EventTransaction['id'];
  };
  source: 'replay-window-sync';
};

function useCrossWindowSync({childWindow}: Options) {
  const {currentHoverTime, currentTime, replay, setCurrentHoverTime, setCurrentTime} =
    useReplayContext();

  const eventId = replay?.getEvent().id;

  const handleMessage = useCallback(
    (event: MessageEvent<ReplayStateChange>) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      const {source, payload} = event.data;

      if (source !== 'replay-window-sync') {
        return;
      }

      if (payload.eventId === eventId) {
        setCurrentTime(payload.currentTime);
        setCurrentHoverTime(payload.currentHoverTime);
      }
    },
    [eventId, setCurrentTime, setCurrentHoverTime]
  );

  useEffect(() => {
    if (document.visibilityState === 'visible' && childWindow) {
      const stateChange = {
        source: 'replay-window-sync',
        payload: {
          currentHoverTime,
          currentTime,
          eventId,
        },
      } as ReplayStateChange;
      childWindow.postMessage(stateChange, window.location.origin);
    }
  }, [eventId, currentTime, currentHoverTime, childWindow]);

  useEffect(() => {
    window.addEventListener('message', handleMessage, false);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);
}

export default useCrossWindowSync;

type Props = {};

export function CrossWindowSync(_props: Props) {
  const devtoolsWinRef = useRef<Window | null>(null);

  useCrossWindowSync({childWindow: devtoolsWinRef.current});

  const handleClick = useCallback(() => {
    devtoolsWinRef.current = window.open(window.location.href);
  }, []);
  return <button onClick={handleClick}>Pop out devtools</button>;
}
