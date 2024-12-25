import type {Dispatch, ReactNode} from 'react';
import {createContext, useCallback, useContext, useEffect, useReducer} from 'react';
import type {Replayer} from '@sentry-internal/rrweb';
import {ReplayerEvents} from '@sentry-internal/rrweb';
import type {
  PlayerState,
  SpeedState,
} from '@sentry-internal/rrweb/typings/replay/machine';

import type {ReplayPrefs} from 'sentry/components/replays/preferences/replayPreferences';
import type {VideoReplayer} from 'sentry/components/replays/videoReplayer';
import {uniq} from 'sentry/utils/array/uniq';
import clamp from 'sentry/utils/number/clamp';
import type {Dimensions} from 'sentry/utils/replays/types';

type ReplayerAction =
  | {isBuffering: boolean; type: 'changeBufferState'}
  | {
      dispatch: Dispatch<ReplayerAction>;
      replayer: Replayer;
      type: 'didMountPlayer';
      videoReplayer: VideoReplayer | null;
    }
  | {replayer: Replayer; type: 'didUnmountPlayer'; videoReplayer: VideoReplayer | null}
  | {type: 'didStart'}
  | {type: 'didPause'}
  | {type: 'didResume'}
  | {type: 'didFinish'}
  | {height: number; type: 'didResize'; width: number}
  | {speed: number; type: 'didSkipStart'}
  | {speed: number; type: 'didSkipEnd'}
  | {type: 'didFlush'}
  | {playerState: PlayerState; type: 'didPlayerStateChange'}
  | {speedState: SpeedState; type: 'didSpeedStateChange'};

type UserAction =
  | {type: 'play'}
  | {type: 'pause'}
  | {
      isSkippingInactive: ReplayPrefs['isSkippingInactive'];
      type: 'setConfigIsSkippingInactive';
    }
  | {playbackSpeed: ReplayPrefs['playbackSpeed']; type: 'setConfigPlaybackSpeed'}
  | {offsetMs: number; type: 'jumpToOffset'};

interface State {
  bufferState: 'buffering' | 'buffering-to-play' | 'ready';
  currentSpeed: undefined | number;
  dimensions: Dimensions;
  isFinished: boolean;
  playerState: 'playing' | 'paused' | 'live';
  replayerCleanup: Map<Replayer | VideoReplayer, () => void>;
  replayers: Replayer[];
  speedState: 'normal' | 'skipping';
  videoReplayers: Map<Replayer, VideoReplayer | null>;
}

function createInitialState(): State {
  return {
    bufferState: 'ready',
    currentSpeed: 1,
    dimensions: {width: 0, height: 0},
    isFinished: false,
    playerState: 'paused',
    replayerCleanup: new Map(),
    replayers: [],
    videoReplayers: new Map<Replayer, VideoReplayer | null>(),
    speedState: 'normal',
  };
}

const StateContext = createContext<State>(createInitialState());
const DispatchContext = createContext<Dispatch<ReplayerAction>>(() => {});
const UserActionContext = createContext((_action: UserAction) => {});

export function ReplayPlayerStateContextProvider({children}: {children: ReactNode}) {
  const [state, dispatch] = useReducer(stateReducer, null, createInitialState);

  const handleUserAction = useCallback(
    (userAction: UserAction) =>
      state.videoReplayers.forEach((videoReplayer, replayer) =>
        invokeUserAction(state, replayer, videoReplayer, userAction)
      ),
    [state]
  );

  useEffect(() => {
    if (state.bufferState === 'buffering-to-play') {
      if (state.playerState === 'playing') {
        handleUserAction({type: 'pause'});
      } else if (state.playerState === 'paused') {
        handleUserAction({type: 'play'});
      }
    }
  }, [handleUserAction, state.bufferState, state.playerState]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        <UserActionContext.Provider value={handleUserAction}>
          {children}
        </UserActionContext.Provider>
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useReplayPlayerState() {
  return useContext(StateContext);
}

export function useReplayPlayerStateDispatch() {
  return useContext(DispatchContext);
}

export function useReplayUserAction() {
  return useContext(UserActionContext);
}

function stateReducer(state: State, replayerAction: ReplayerAction): State {
  switch (replayerAction.type) {
    case 'changeBufferState':
      if (replayerAction.isBuffering) {
        return {
          ...state,
          bufferState:
            state.playerState === 'playing' ? 'buffering-to-play' : 'buffering',
        };
      }
      return {...state, bufferState: 'ready'};
    case 'didMountPlayer': {
      const {dispatch, replayer, videoReplayer} = replayerAction;
      state.replayerCleanup.set(replayer, subscribeToReplayer(replayer, dispatch));
      applyStateToReplayer(state, replayer, state.replayers.at(0));

      if (videoReplayer) {
        state.replayerCleanup.set(videoReplayer, () => {
          videoReplayer.destroy(); // Cleanup the videoReplayer? What about the remove() call?
        });
        applyStateToReplayer(state, videoReplayer, state.replayers.at(0));
      }

      return {
        ...state,
        videoReplayers: state.videoReplayers.set(replayer, videoReplayer),
        replayers: uniq([...state.replayers, replayer]),
      };
    }
    case 'didUnmountPlayer': {
      const {replayer, videoReplayer} = replayerAction;
      state.replayerCleanup.get(replayer)?.();
      state.replayerCleanup.delete(replayer);

      if (videoReplayer) {
        state.videoReplayers.delete(replayer);
        state.replayerCleanup.get(videoReplayer)?.();
        state.replayerCleanup.delete(videoReplayer);
      }

      // Don't call destroy. It basically just removes the component from the
      // DOM and then triggers `ReplayerEvents.Destroy`.

      return {
        ...state,
        replayers: state.replayers.filter(r => r !== replayer),
      };
    }
    case 'didStart':
      return {...state, playerState: 'playing', isFinished: false};
    case 'didPause':
      return {...state, playerState: 'paused', isFinished: false};
    case 'didResume':
      return {...state, playerState: 'playing', isFinished: false};
    case 'didFinish':
      return {...state, playerState: 'paused', isFinished: true};

    case 'didResize':
      if (
        state.dimensions.width === replayerAction.width &&
        state.dimensions.height === replayerAction.height
      ) {
        return state;
      }
      return {
        ...state,
        dimensions: {width: replayerAction.width, height: replayerAction.height},
      };
    case 'didSkipStart':
      return {...state, speedState: 'skipping', currentSpeed: replayerAction.speed};
    case 'didSkipEnd':
      return {...state, speedState: 'normal', currentSpeed: replayerAction.speed};
    case 'didFlush':
      return state;

    case 'didPlayerStateChange':
      return state;
    case 'didSpeedStateChange':
      return {...state, currentSpeed: replayerAction.speedState.context.timer.speed};
    default:
      // @ts-expect-error: Unreachable code: the switch should be exhaustive and cover all possible values.
      throw Error('Unknown action: ' + replayerAction.type);
  }
}

function invokeUserAction(
  state: State,
  replayer: Replayer,
  videoReplayer: VideoReplayer | null,
  userAction: UserAction
): void {
  switch (userAction.type) {
    case 'play': {
      if (state.bufferState === 'ready') {
        const currentTime = replayer.getCurrentTime();
        replayer.play(currentTime);
        videoReplayer?.play(currentTime);
      }
      return;
    }
    case 'pause': {
      if (state.bufferState === 'buffering-to-play') {
        state.bufferState = 'buffering';
      }
      const currentTime = replayer.getCurrentTime();
      replayer.pause(currentTime);
      videoReplayer?.pause(currentTime);
      return;
    }
    case 'setConfigIsSkippingInactive':
      // not supported by videoReplay
      if (!videoReplayer) {
        replayer.setConfig({skipInactive: userAction.isSkippingInactive});
      }
      return;

    case 'setConfigPlaybackSpeed':
      replayer.setConfig({speed: userAction.playbackSpeed});
      videoReplayer?.setConfig({speed: userAction.playbackSpeed});
      return;

    case 'jumpToOffset': {
      const offsetMs = clamp(userAction.offsetMs, 0, replayer.getMetaData().totalTime);
      // TOOD: going back to the start of the replay needs to re-build & re-render the first frame I think.

      const skipInactive = replayer.config.skipInactive;
      // If the replayer is set to skip inactive, we should turn it off before
      // manually scrubbing, so when the player resumes playing it's not stuck
      // fast-forwarding even through sections with activity
      replayer.setConfig({skipInactive: false});

      if (replayer.service.state.value === 'playing') {
        replayer.play(offsetMs);
        videoReplayer?.play(offsetMs);
      } else {
        replayer.pause(offsetMs);
        videoReplayer?.pause(offsetMs);
      }

      replayer.setConfig({skipInactive});

      return;
    }
    default:
      // @ts-expect-error: Unreachable code: the switch should be exhaustive and cover all possible values.
      throw Error('Unknown action: ' + action.type);
  }
}

type EventHandler<E = any> = (event: E) => void;
type ResizeEventArg = {height: number; width: number};
type SkipEventArg = {speed: number};
type StateChangeEventArg = {player: PlayerState} | {speed: SpeedState};

function makeReplayerEventMap(
  dispatch: Dispatch<ReplayerAction>
): Record<ReplayerEvents, EventHandler> {
  return {
    [ReplayerEvents.Start]: () => {
      dispatch({type: 'didStart'});
    },
    [ReplayerEvents.Pause]: () => {
      dispatch({type: 'didPause'});
    },
    [ReplayerEvents.Resume]: () => {
      dispatch({type: 'didResume'});
    },
    [ReplayerEvents.Finish]: () => {
      dispatch({type: 'didFinish'});
    },

    [ReplayerEvents.Resize]: (({width, height}) => {
      dispatch({type: 'didResize', width, height});
    }) as EventHandler<ResizeEventArg>,
    [ReplayerEvents.SkipStart]: (({speed}) => {
      dispatch({type: 'didSkipStart', speed});
    }) as EventHandler<SkipEventArg>,
    [ReplayerEvents.SkipEnd]: (({speed}) => {
      dispatch({type: 'didSkipEnd', speed});
    }) as EventHandler<SkipEventArg>,

    [ReplayerEvents.StateChange]: (event => {
      if ('player' in event) {
        dispatch({type: 'didPlayerStateChange', playerState: event.player});
      }
      if ('speed' in event) {
        dispatch({type: 'didSpeedStateChange', speedState: event.speed});
      }
    }) as EventHandler<StateChangeEventArg>,

    [ReplayerEvents.PlayBack]: () => {},
    [ReplayerEvents.Flush]: () => {
      dispatch({type: 'didFlush'});
    },
    [ReplayerEvents.FullsnapshotRebuilded]: () => {},
    [ReplayerEvents.LoadStylesheetStart]: () => {},
    [ReplayerEvents.LoadStylesheetEnd]: () => {},
    [ReplayerEvents.MouseInteraction]: () => {},
    [ReplayerEvents.EventCast]: () => {},
    [ReplayerEvents.CustomEvent]: () => {},
    [ReplayerEvents.Destroy]: () => {}, // Won't be called because we're not calling replay.destroy()
  };
}

function subscribeToReplayer(replayer: Replayer, dispatch: Dispatch<ReplayerAction>) {
  const eventMap = makeReplayerEventMap(dispatch);
  Object.entries(eventMap).forEach(([name, handler]) => {
    replayer.on(name, handler);
  });

  return () => {
    Object.entries(eventMap).forEach(([name, handler]) => {
      replayer.off(name, handler);
    });
  };
}

function applyStateToReplayer(
  state: State,
  replayer: Replayer | VideoReplayer,
  templateReplayer: Replayer | undefined
) {
  const currentTime = Math.max(0, templateReplayer?.getCurrentTime() ?? 0);

  // Set sane defaults:
  replayer.pause(currentTime);

  // Catch up to existing players, if any
  if (state.playerState === 'playing') {
    replayer.play(currentTime);
  }
}
