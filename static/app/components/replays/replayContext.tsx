import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import {Replayer, ReplayerEvents} from '@sentry-internal/rrweb';

import type {
  PrefsStrategy,
  ReplayPrefs,
} from 'sentry/components/replays/preferences/replayPreferences';
import useReplayHighlighting from 'sentry/components/replays/useReplayHighlighting';
import {trackAnalytics} from 'sentry/utils/analytics';
import clamp from 'sentry/utils/number/clamp';
import type useInitialOffsetMs from 'sentry/utils/replays/hooks/useInitialTimeOffsetMs';
import useRAF from 'sentry/utils/replays/hooks/useRAF';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import {useUser} from 'sentry/utils/useUser';

import {CanvasReplayerPlugin} from './canvasReplayerPlugin';

type Dimensions = {height: number; width: number};
type RootElem = null | HTMLDivElement;

type HighlightCallbacks = ReturnType<typeof useReplayHighlighting>;

// Important: Don't allow context Consumers to access `Replayer` directly.
// It has state that, when changed, will not trigger a react render.
// Instead only expose methods that wrap `Replayer` and manage state.
interface ReplayPlayerContextProps extends HighlightCallbacks {
  /**
   * The context in which the replay is being viewed.
   */
  analyticsContext: string;

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
  analyticsContext: '',
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
  /**
   * The context in which the replay is being viewed.
   * Attached to certain analytics events.
   */
  analyticsContext: string;

  children: React.ReactNode;

  /**
   * Is the data inside the `replay` complete, or are we waiting for more.
   */
  isFetching: boolean;

  /**
   * The strategy for saving/loading preferences, like the playback speed
   */
  prefsStrategy: PrefsStrategy;

  replay: ReplayReader | null;

  /**
   * Start the video as soon as it's ready
   */
  autoStart?: boolean;

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

export function Provider({
  analyticsContext,
  children,
  initialTimeOffsetMs,
  isFetching,
  prefsStrategy,
  replay,
  autoStart,
  value = {},
}: Props) {
  const user = useUser();
  const organization = useOrganization();
  const events = replay?.getRRWebFrames();
  const savedReplayConfigRef = useRef<ReplayPrefs>(prefsStrategy.get());

  const theme = useTheme();
  const oldEvents = usePrevious(events);
  // Note we have to check this outside of hooks, see `usePrevious` comments
  const hasNewEvents = events !== oldEvents;
  const replayerRef = useRef<Replayer>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({height: 0, width: 0});
  const [currentHoverTime, setCurrentHoverTime] = useState<undefined | number>();
  const [isPlaying, setIsPlaying] = useState(!!autoStart);
  const [finishedAtMS, setFinishedAtMS] = useState<number>(-1);
  const [isSkippingInactive, setIsSkippingInactive] = useState(
    savedReplayConfigRef.current.isSkippingInactive
  );
  const [speed, setSpeedState] = useState(savedReplayConfigRef.current.playbackSpeed);
  const [fastForwardSpeed, setFFSpeed] = useState(0);
  const [buffer, setBufferTime] = useState({target: -1, previous: -1});
  const playTimer = useRef<number | undefined>(undefined);
  const didApplyInitialOffset = useRef(false);
  const [timelineScale, setTimelineScale] = useState(1);

  const durationMs = replay?.getDurationMs() ?? 0;
  const startTimeOffsetMs = replay?.getStartOffsetMs() ?? 0;

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

  const getCurrentPlayerTime = useCallback(
    () => (replayerRef.current ? Math.max(replayerRef.current.getCurrentTime(), 0) : 0),
    []
  );

  const isFinished = getCurrentPlayerTime() === finishedAtMS;
  const setReplayFinished = useCallback(() => {
    setFinishedAtMS(getCurrentPlayerTime());
    setIsPlaying(false);
  }, [getCurrentPlayerTime]);

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

      const time = clamp(requestedTimeMs, 0, startTimeOffsetMs + durationMs);

      // Sometimes rrweb doesn't get to the exact target time, as long as it has
      // changed away from the previous time then we can hide then buffering message.
      setBufferTime({target: time, previous: getCurrentPlayerTime()});

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
    [startTimeOffsetMs, durationMs, getCurrentPlayerTime, isPlaying]
  );

  const setCurrentTime = useCallback(
    (requestedTimeMs: number) => {
      privateSetCurrentTime(requestedTimeMs + startTimeOffsetMs);
      clearAllHighlights();
    },
    [privateSetCurrentTime, startTimeOffsetMs, clearAllHighlights]
  );

  const applyInitialOffset = useCallback(() => {
    const offsetMs = (initialTimeOffsetMs?.offsetMs ?? 0) + startTimeOffsetMs;

    if (
      !didApplyInitialOffset.current &&
      (initialTimeOffsetMs || offsetMs) &&
      events &&
      replayerRef.current
    ) {
      const highlightArgs = initialTimeOffsetMs?.highlight;
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
    startTimeOffsetMs,
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
        skipInactive: savedReplayConfigRef.current.isSkippingInactive,
        speed: savedReplayConfigRef.current.playbackSpeed,
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
        playbackSpeed: newSpeed,
      };

      prefsStrategy.set(savedReplayConfigRef.current);

      if (!replayer) {
        return;
      }
      if (isPlaying) {
        replayer.pause();
        replayer.setConfig({speed: newSpeed});
        replayer.play(getCurrentPlayerTime());
      } else {
        replayer.setConfig({speed: newSpeed});
      }

      setSpeedState(newSpeed);
    },
    [prefsStrategy, getCurrentPlayerTime, isPlaying]
  );

  const togglePlayPause = useCallback(
    (play: boolean) => {
      const replayer = replayerRef.current;
      if (!replayer) {
        return;
      }

      if (play) {
        replayer.play(getCurrentPlayerTime());
      } else {
        replayer.pause(getCurrentPlayerTime());
      }
      setIsPlaying(play);

      trackAnalytics('replay.play-pause', {
        organization,
        user_email: user.email,
        play,
        context: analyticsContext,
      });
    },
    [organization, user.email, analyticsContext, getCurrentPlayerTime]
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
      replayerRef.current.play(startTimeOffsetMs);
      setIsPlaying(true);
    }
  }, [startTimeOffsetMs]);

  const toggleSkipInactive = useCallback(
    (skip: boolean) => {
      const replayer = replayerRef.current;
      savedReplayConfigRef.current = {
        ...savedReplayConfigRef.current,
        isSkippingInactive: skip,
      };

      prefsStrategy.set(savedReplayConfigRef.current);

      if (!replayer) {
        return;
      }
      if (skip !== replayer.config.skipInactive) {
        replayer.setConfig({skipInactive: skip});
      }

      setIsSkippingInactive(skip);
    },
    [prefsStrategy]
  );

  const currentPlayerTime = useCurrentTime(getCurrentPlayerTime);

  const [isBuffering, currentBufferedPlayerTime] =
    buffer.target !== -1 &&
    buffer.previous === currentPlayerTime &&
    buffer.target !== buffer.previous
      ? [true, buffer.target]
      : [false, currentPlayerTime];

  const currentTime = currentBufferedPlayerTime - startTimeOffsetMs;

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
        analyticsContext,
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
