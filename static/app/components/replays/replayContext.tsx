import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import {Replayer, ReplayerEvents} from '@sentry-internal/rrweb';

import useReplayHighlighting from 'sentry/components/replays/useReplayHighlighting';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import localStorage from 'sentry/utils/localStorage';
import type useInitialOffsetMs from 'sentry/utils/replays/hooks/useInitialTimeOffsetMs';
import useRAF from 'sentry/utils/replays/hooks/useRAF';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';

import {CanvasReplayerPlugin} from './canvasReplayerPlugin';

enum ReplayLocalstorageKeys {
  REPLAY_CONFIG = 'replay-config',
}
type ReplayConfig = {
  skip?: boolean;
  speed?: number;
};

type Dimensions = {height: number; width: number};
type RootElem = null | HTMLDivElement;

type HighlightCallbacks = ReturnType<typeof useReplayHighlighting>;

// Important: Don't allow context Consumers to access `Replayer` directly.
// It has state that, when changed, will not trigger a react render.
// Instead only expose methods that wrap `Replayer` and manage state.
interface ReplayPlayerContextProps extends HighlightCallbacks {
  /**
   * The time, in milliseconds, where the user focus is.
   * The user focus can be reported by any collaborating object, usually on
   * hover.
   */
  currentHoverTime: undefined | number;

  /**
   * The current time of the video, in milliseconds
   * The value is updated on every animation frame, about every 16.6ms
   */
  currentTime: number;

  /**
   * Original dimensions in pixels of the captured browser window
   */
  dimensions: Dimensions;

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
   * Set to true while the library is reconstructing the DOM
   */
  isBuffering: boolean;

  /**
   * Is the data inside the `replay` complete, or are we waiting for more.
   */
  isFetching;

  /**
   * Set to true when the replay finish event is fired
   */
  isFinished: boolean;

  /**
   * Whether the video is currently playing
   */
  isPlaying: boolean;

  /**
   * Whether fast-forward mode is enabled if RRWeb detects idle moments in the video
   */
  isSkippingInactive: boolean;

  /**
   * The core replay data
   */
  replay: ReplayReader | null;

  /**
   * Restart the replay
   */
  restart: () => void;

  /**
   * Set the currentHoverTime so collaborating components can highlight related
   * information
   */
  setCurrentHoverTime: (time: undefined | number) => void;

  /**
   * Jump the video to a specific time
   */
  setCurrentTime: (time: number) => void;

  /**
   * Set speed for normal playback
   */
  setSpeed: (speed: number) => void;

  /**
   * Set the timeline width to the specific scale, starting at 1x and growing larger
   */
  setTimelineScale: (size: number) => void;

  /**
   * The speed for normal playback
   */
  speed: number;

  /**
   * Scale of the timeline width, starts from 1x and increases by 1x
   */
  timelineScale: number;

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
}

const ReplayPlayerContext = createContext<ReplayPlayerContextProps>({
  clearAllHighlights: () => {},
  currentHoverTime: undefined,
  currentTime: 0,
  dimensions: {height: 0, width: 0},
  fastForwardSpeed: 0,
  addHighlight: () => {},
  initRoot: () => {},
  isBuffering: false,
  isFetching: false,
  isFinished: false,
  isPlaying: false,
  isSkippingInactive: true,
  removeHighlight: () => {},
  replay: null,
  restart: () => {},
  setCurrentHoverTime: () => {},
  setCurrentTime: () => {},
  setSpeed: () => {},
  setTimelineScale: () => {},
  speed: 1,
  timelineScale: 1,
  togglePlayPause: () => {},
  toggleSkipInactive: () => {},
});

type Props = {
  children: React.ReactNode;

  /**
   * Is the data inside the `replay` complete, or are we waiting for more.
   */
  isFetching: boolean;

  replay: ReplayReader | null;

  /**
   * Time, in seconds, when the video should start
   */
  initialTimeOffsetMs?: ReturnType<typeof useInitialOffsetMs>;

  /**
   * Override return fields for testing
   */
  value?: Partial<ReplayPlayerContextProps>;
};

function useCurrentTime(callback: () => number) {
  const [currentTime, setCurrentTime] = useState(0);
  useRAF(() => setCurrentTime(callback));
  return currentTime;
}

function updateSavedReplayConfig(config: ReplayConfig) {
  localStorage.setItem(ReplayLocalstorageKeys.REPLAY_CONFIG, JSON.stringify(config));
}

export function Provider({
  children,
  initialTimeOffsetMs,
  isFetching,
  replay,
  value = {},
}: Props) {
  const config = useLegacyStore(ConfigStore);
  const organization = useOrganization();
  const events = replay?.getRRWebFrames();
  const savedReplayConfigRef = useRef<ReplayConfig>(
    JSON.parse(localStorage.getItem(ReplayLocalstorageKeys.REPLAY_CONFIG) || '{}')
  );

  const theme = useTheme();
  const oldEvents = usePrevious(events);
  // Note we have to check this outside of hooks, see `usePrevious` comments
  const hasNewEvents = events !== oldEvents;
  const replayerRef = useRef<Replayer>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({height: 0, width: 0});
  const [currentHoverTime, setCurrentHoverTime] = useState<undefined | number>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [finishedAtMS, setFinishedAtMS] = useState<number>(-1);
  const [isSkippingInactive, setIsSkippingInactive] = useState(
    savedReplayConfigRef.current.skip ?? true
  );
  const [speed, setSpeedState] = useState(savedReplayConfigRef.current.speed || 1);
  const [fastForwardSpeed, setFFSpeed] = useState(0);
  const [buffer, setBufferTime] = useState({target: -1, previous: -1});
  const playTimer = useRef<number | undefined>(undefined);
  const didApplyInitialOffset = useRef(false);
  const [timelineScale, setTimelineScale] = useState(1);

  const isFinished = replayerRef.current?.getCurrentTime() === finishedAtMS;

  const forceDimensions = (dimension: Dimensions) => {
    setDimensions(dimension);
  };
  const onFastForwardStart = (e: {speed: number}) => {
    setFFSpeed(e.speed);
  };
  const onFastForwardEnd = () => {
    setFFSpeed(0);
  };

  const {addHighlight, clearAllHighlights, removeHighlight} = useReplayHighlighting({
    replayerRef,
  });

  const setReplayFinished = useCallback(() => {
    setFinishedAtMS(replayerRef.current?.getCurrentTime() ?? -1);
    setIsPlaying(false);
  }, []);

  const getCurrentTime = useCallback(
    () => (replayerRef.current ? Math.max(replayerRef.current.getCurrentTime(), 0) : 0),
    []
  );

  const privateSetCurrentTime = useCallback(
    (requestedTimeMs: number) => {
      const replayer = replayerRef.current;
      if (!replayer) {
        return;
      }

      const skipInactive = replayer.config;
      if (skipInactive) {
        // If the replayer is set to skip inactive, we should turn it off before
        // manually scrubbing, so when the player resumes playing its not stuck
        replayer.setConfig({skipInactive: false});
      }

      const maxTimeMs = replayerRef.current?.getMetaData().totalTime;
      const time = requestedTimeMs > maxTimeMs ? 0 : Math.max(0, requestedTimeMs);

      // Sometimes rrweb doesn't get to the exact target time, as long as it has
      // changed away from the previous time then we can hide then buffering message.
      setBufferTime({target: time, previous: getCurrentTime()});

      // Clear previous timers. Without this (but with the setTimeout) multiple
      // requests to set the currentTime could finish out of order and cause jumping.
      if (playTimer.current) {
        window.clearTimeout(playTimer.current);
      }
      if (skipInactive) {
        replayer.setConfig({skipInactive: true});
      }
      if (isPlaying) {
        playTimer.current = window.setTimeout(() => replayer.play(time), 0);
        setIsPlaying(true);
      } else {
        playTimer.current = window.setTimeout(() => replayer.pause(time), 0);
        setIsPlaying(false);
      }
    },
    [getCurrentTime, isPlaying]
  );

  const setCurrentTime = useCallback(
    (requestedTimeMs: number) => {
      privateSetCurrentTime(requestedTimeMs);
      clearAllHighlights();
    },
    [privateSetCurrentTime, clearAllHighlights]
  );

  const applyInitialOffset = useCallback(() => {
    if (
      !didApplyInitialOffset.current &&
      initialTimeOffsetMs &&
      events &&
      replayerRef.current
    ) {
      const {highlight: highlightArgs, offsetMs} = initialTimeOffsetMs;
      if (offsetMs > 0) {
        privateSetCurrentTime(offsetMs);
      }
      if (highlightArgs) {
        addHighlight(highlightArgs);
        setTimeout(() => {
          clearAllHighlights();
          addHighlight(highlightArgs);
        });
      }
      didApplyInitialOffset.current = true;
    }
  }, [
    clearAllHighlights,
    events,
    addHighlight,
    initialTimeOffsetMs,
    privateSetCurrentTime,
  ]);

  useEffect(clearAllHighlights, [clearAllHighlights, isPlaying]);

  const initRoot = useCallback(
    (root: RootElem) => {
      if (events === undefined || root === null || isFetching) {
        return;
      }

      if (replayerRef.current) {
        if (!hasNewEvents) {
          return;
        }

        if (replayerRef.current.iframe.contentDocument?.body.childElementCount === 0) {
          // If this is true, then no need to clear old iframe as nothing was rendered
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
        blockClass: 'sentry-block',
        mouseTail: {
          duration: 0.75 * 1000,
          lineCap: 'round',
          lineWidth: 2,
          strokeStyle: theme.purple200,
        },
        plugins: organization.features.includes('session-replay-enable-canvas-replayer')
          ? [CanvasReplayerPlugin(events)]
          : [],
        skipInactive: savedReplayConfigRef.current.skip ?? true,
        speed: savedReplayConfigRef.current.speed || 1,
      });

      // @ts-expect-error: rrweb types event handlers with `unknown` parameters
      inst.on(ReplayerEvents.Resize, forceDimensions);
      inst.on(ReplayerEvents.Finish, setReplayFinished);
      // @ts-expect-error: rrweb types event handlers with `unknown` parameters
      inst.on(ReplayerEvents.SkipStart, onFastForwardStart);
      inst.on(ReplayerEvents.SkipEnd, onFastForwardEnd);

      // `.current` is marked as readonly, but it's safe to set the value from
      // inside a `useEffect` hook.
      // See: https://reactjs.org/docs/hooks-faq.html#is-there-something-like-instance-variables
      // @ts-expect-error
      replayerRef.current = inst;

      applyInitialOffset();
    },
    [
      events,
      isFetching,
      theme.purple200,
      setReplayFinished,
      hasNewEvents,
      applyInitialOffset,
      organization.features,
    ]
  );

  const setSpeed = useCallback(
    (newSpeed: number) => {
      const replayer = replayerRef.current;
      savedReplayConfigRef.current = {
        ...savedReplayConfigRef.current,
        speed: newSpeed,
      };

      updateSavedReplayConfig(savedReplayConfigRef.current);

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
    [getCurrentTime, isPlaying]
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

      trackAnalytics('replay.play-pause', {
        organization,
        user_email: config.user.email,
        play,
      });
    },
    [getCurrentTime, config.user.email, organization]
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        togglePlayPause(false);
      }
    };

    if (replayerRef.current && events) {
      initRoot(replayerRef.current.wrapper.parentElement as RootElem);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [initRoot, events, togglePlayPause]);

  const restart = useCallback(() => {
    if (replayerRef.current) {
      replayerRef.current.play(0);
      setIsPlaying(true);
    }
  }, []);

  const toggleSkipInactive = useCallback((skip: boolean) => {
    const replayer = replayerRef.current;
    savedReplayConfigRef.current = {
      ...savedReplayConfigRef.current,
      skip,
    };

    updateSavedReplayConfig(savedReplayConfigRef.current);

    if (!replayer) {
      return;
    }
    if (skip !== replayer.config.skipInactive) {
      replayer.setConfig({skipInactive: skip});
    }

    setIsSkippingInactive(skip);
  }, []);

  const currentPlayerTime = useCurrentTime(getCurrentTime);

  const [isBuffering, currentTime] =
    buffer.target !== -1 &&
    buffer.previous === currentPlayerTime &&
    buffer.target !== buffer.previous
      ? [true, buffer.target]
      : [false, currentPlayerTime];

  useEffect(() => {
    if (!isBuffering && events && events.length >= 2 && replayerRef.current) {
      applyInitialOffset();
    }
  }, [isBuffering, events, applyInitialOffset]);

  useEffect(() => {
    if (!isBuffering && buffer.target !== -1) {
      setBufferTime({target: -1, previous: -1});
    }
  }, [isBuffering, buffer.target]);

  return (
    <ReplayPlayerContext.Provider
      value={{
        clearAllHighlights,
        currentHoverTime,
        currentTime,
        dimensions,
        fastForwardSpeed,
        addHighlight,
        initRoot,
        isBuffering,
        isFetching,
        isFinished,
        isPlaying,
        isSkippingInactive,
        removeHighlight,
        replay,
        restart,
        setCurrentHoverTime,
        setCurrentTime,
        setSpeed,
        setTimelineScale,
        speed,
        timelineScale,
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
