import React, {useCallback, useContext, useEffect, useRef, useState} from 'react';
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
  /**
   * The current time of the video, in miliseconds
   * The value is updated on every animation frame, about every 16.6ms
   */
  currentTime: number;

  /**
   * Original dimensions in pixels of the captured browser window
   */
  dimensions: Dimensions;

  /**
   * Duration of the video, in miliseconds
   */
  duration: undefined | number;

  /**
   * Raw RRWeb events
   */
  events: ReadonlyArray<eventWithTime>;

  /**
   * The calculated speed of the player when fast-forwarding through idle moments in the video
   * The value is set to `0` when the video is not fast-forwarding
   * The speed is automatically determined by the length of each idle period
   */
  fastForwardSpeed: number;

  /**
   * Required to be called with a <div> Ref
   * Represents the location in the DOM where the iframe video should be mounted
   *
   * @param _root
   */
  initRoot: (root: RootElem) => void;

  /**
   * Whether the video is currently playing
   */
  isPlaying: boolean;

  /**
   * Whether fast-forward mode is enabled if RRWeb detects idle moments in the video
   */
  isSkippingInactive: boolean;

  /**
   * Jump the video to a specific time
   */
  setCurrentTime: (time: number) => void;

  /**
   * Set speed for normal playback
   */
  setSpeed: (speed: number) => void;

  /**
   * The speed for normal playback
   */
  speed: number;

  /**
   * Start or stop playback
   *
   * @param play
   */
  togglePlayPause: (play: boolean) => void;

  /**
   * Allow RRWeb to use Fast-Forward mode for idle moments in the video
   *
   * @param skip
   */
  toggleSkipInactive: (skip: boolean) => void;
};

const ReplayPlayerContext = React.createContext<ReplayPlayerContextProps>({
  currentTime: 0,
  dimensions: {height: 0, width: 0},
  duration: undefined,
  events: [],
  fastForwardSpeed: 0,
  initRoot: () => {},
  isPlaying: false,
  isSkippingInactive: false,
  setCurrentTime: () => {},
  setSpeed: () => {},
  speed: 1,
  togglePlayPause: () => {},
  toggleSkipInactive: () => {},
});

type Props = {
  children: React.ReactNode;
  events: eventWithTime[];
  value?: Partial<ReplayPlayerContextProps>;
};

function useCurrentTime(callback: () => number) {
  const [currentTime, setCurrentTime] = useState(0);
  useRAF(() => setCurrentTime(callback));
  return currentTime;
}

export function Provider({children, events, value = {}}: Props) {
  const theme = useTheme();
  const oldEvents = usePrevious(events);
  const replayerRef = useRef<Replayer>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({height: 0, width: 0});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSkippingInactive, setIsSkippingInactive] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [fastForwardSpeed, setFFSpeed] = useState(0);

  const forceDimensions = (dimension: Dimensions) => {
    setDimensions(dimension);
  };
  const setPlayingFalse = () => {
    setIsPlaying(false);
  };
  const onFastForwardStart = (e: {speed: number}) => {
    setFFSpeed(e.speed);
  };
  const onFastForwardEnd = () => {
    setFFSpeed(0);
  };

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

      // We have new events, need to clear out the old iframe because a new
      // `Replayer` instance is about to be created
      while (root.firstChild) {
        root.removeChild(root.firstChild);
      }
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

    // @ts-expect-error: rrweb types event handlers with `unknown` parameters
    inst.on(ReplayerEvents.Resize, forceDimensions);
    inst.on(ReplayerEvents.Finish, setPlayingFalse);
    // @ts-expect-error: rrweb types event handlers with `unknown` parameters
    inst.on(ReplayerEvents.SkipStart, onFastForwardStart);
    inst.on(ReplayerEvents.SkipEnd, onFastForwardEnd);

    // `.current` is marked as readonly, but it's safe to set the value from
    // inside a `useEffect` hook.
    // See: https://reactjs.org/docs/hooks-faq.html#is-there-something-like-instance-variables
    // @ts-expect-error
    replayerRef.current = inst;
  };

  useEffect(() => {
    if (replayerRef.current && events) {
      initRoot(replayerRef.current.wrapper.parentElement as RootElem);
    }
  }, [events, initRoot]);

  const getCurrentTime = useCallback(
    () => (replayerRef.current ? Math.max(replayerRef.current.getCurrentTime(), 0) : 0),
    []
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
    [isPlaying]
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
    [isPlaying]
  );

  const togglePlayPause = useCallback((play: boolean) => {
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
  }, []);

  const toggleSkipInactive = useCallback((skip: boolean) => {
    const replayer = replayerRef.current;
    if (!replayer) {
      return;
    }
    if (skip !== replayer.config.skipInactive) {
      replayer.setConfig({skipInactive: skip});
    }
    setIsSkippingInactive(skip);
  }, []);

  const currentTime = useCurrentTime(getCurrentTime);

  return (
    <ReplayPlayerContext.Provider
      value={{
        currentTime,
        dimensions,
        duration: replayerRef.current?.getMetaData().totalTime,
        events,
        fastForwardSpeed,
        initRoot,
        isPlaying,
        isSkippingInactive,
        setCurrentTime,
        setSpeed,
        speed,
        togglePlayPause,
        toggleSkipInactive,
        ...value,
      }}
    >
      {children}
    </ReplayPlayerContext.Provider>
  );
}

export const useReplayContext = () => useContext(ReplayPlayerContext);
