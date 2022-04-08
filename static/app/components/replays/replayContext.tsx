import React, {useCallback, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import {Replayer, ReplayerEvents} from 'rrweb';
import type {eventWithTime} from 'rrweb/typings/types';

import usePrevious from 'sentry/utils/usePrevious';

import useRAF from './useRAF';

type Dimensions = {height: number; width: number};
type RootElem = null | HTMLDivElement;

// Important: Don't allow context Consumers to access `Replayer` directly.
// It has state that, when changed, will not trigger a react render.
// Instead only expose methods that wrap `Replayer` and manage state.
type ReplayPlayerContextProps = {
  currentTime: number;
  dimensions: Dimensions;
  duration: undefined | number;
  events: eventWithTime[];
  initRoot: (root: RootElem) => void;
  isPlaying: boolean;
  setCurrentTime: (time: number) => void;
  setSpeed: (speed: number) => void;
  skipInactive: boolean;
  speed: number;
  togglePlayPause: (play: boolean) => void;
  toggleSkipInactive: (skip: boolean) => void;
};

const ReplayPlayerContext = React.createContext<ReplayPlayerContextProps>({
  currentTime: 0,
  dimensions: {height: 0, width: 0},
  duration: undefined,
  events: [],
  initRoot: _root => {},
  isPlaying: false,
  setCurrentTime: () => {},
  setSpeed: () => {},
  skipInactive: false,
  speed: 1,
  togglePlayPause: () => {},
  toggleSkipInactive: () => {},
});

type Props = {
  events: eventWithTime[];
};

function useCurrentTime(callback: () => number) {
  const [currentTime, setCurrentTime] = useState(0);
  useRAF(() => setCurrentTime(callback));
  return currentTime;
}

export function Provider({children, events}: React.PropsWithChildren<Props>) {
  const theme = useTheme();
  const oldEvents = usePrevious(events);
  const replayerRef = useRef<Replayer>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({height: 0, width: 0});
  const [isPlaying, setIsPlaying] = useState(false);
  const [skipInactive, setSkipInactive] = useState(false);
  const [speed, setSpeedState] = useState(1);

  const initRoot = (root: RootElem) => {
    if (events === undefined) {
      return;
    }

    if (root === null) {
      return;
    }

    if (replayerRef.current) {
      if (events === oldEvents) {
        // Already have a player for these events, the parent node must've re-rendered
        return;
      }
      // TODO: need to replace events that the player knows about
      return;
    }

    // eslint-disable-next-line no-new
    const inst = new Replayer(events, {
      root,
      // blockClass: 'rr-block',
      // liveMode: false,
      // triggerFocus: false,
      mouseTail: {
        duration: 0.75 * 1000,
        lineCap: 'round',
        lineWidth: 2,
        strokeStyle: theme.purple200,
      },
      // unpackFn: _ => _,
      // plugins: [],
    });

    inst.on(ReplayerEvents.Resize, dimension => {
      setDimensions(dimension as Dimensions);
    });

    // `.current` is marked as readonly, but it's safe to set the value from
    // inside a `useEffect` hook.
    // See: https://reactjs.org/docs/hooks-faq.html#is-there-something-like-instance-variables
    // @ts-expect-error
    replayerRef.current = inst;
  };

  const getCurrentTime = useCallback(
    () => (replayerRef.current ? Math.max(replayerRef.current.getCurrentTime(), 0) : 0),
    [replayerRef.current]
  );

  const setCurrentTime = useCallback(
    (time: number) => {
      const replayer = replayerRef.current;
      if (!replayer) {
        return;
      }

      // TODO: it might be nice to always just pause() here
      // Why? People can drag the scrobber, or click 'back 10s' and then be in a
      // paused state to inspect things.
      if (isPlaying) {
        replayer.play(time);
        setIsPlaying(true);
      } else {
        replayer.pause(time);
        setIsPlaying(false);
      }
    },
    [replayerRef.current, isPlaying]
  );

  const setSpeed = useCallback(
    (newSpeed: number) => {
      const replayer = replayerRef.current;
      if (!replayer) {
        return;
      }
      if (isPlaying) {
        replayer.pause();
        replayer.setConfig({speed: newSpeed});
        replayer.play(getCurrentTime());
      } else {
        replayer.setConfig({speed: newSpeed});
      }
      setSpeedState(newSpeed);
    },
    [replayerRef.current, isPlaying]
  );

  const togglePlayPause = useCallback(
    (play: boolean) => {
      const replayer = replayerRef.current;
      if (!replayer) {
        return;
      }

      if (play) {
        replayer.play(getCurrentTime());
      } else {
        replayer.pause(getCurrentTime());
      }
      setIsPlaying(play);
    },
    [replayerRef.current]
  );

  const toggleSkipInactive = useCallback(
    (skip: boolean) => {
      const replayer = replayerRef.current;
      if (!replayer) {
        return;
      }
      if (skip !== replayer.config.skipInactive) {
        replayer.setConfig({skipInactive: skip});
      }
      setSkipInactive(skip);
    },
    [replayerRef.current]
  );

  // if (replayerRef.current) {
  //   console.log({
  //     replayerRef,
  //     currentTime: replayerRef.current.getCurrentTime(),
  //     metadata: replayerRef.current.getMetaData(),
  //     mirror: replayerRef.current.getMirror(),
  //     timeOffset: replayerRef.current.getTimeOffset(),
  //     config: replayerRef.current.config,
  //   });
  // }

  const currentTime = useCurrentTime(getCurrentTime);

  return (
    <ReplayPlayerContext.Provider
      value={{
        currentTime,
        dimensions,
        duration: replayerRef.current?.getMetaData().totalTime,
        events,
        initRoot,
        isPlaying,
        setCurrentTime,
        setSpeed,
        skipInactive,
        speed,
        togglePlayPause,
        toggleSkipInactive,
      }}
    >
      {children}
    </ReplayPlayerContext.Provider>
  );
}

export const Consumer = ReplayPlayerContext.Consumer;
