import {type HTMLAttributes, useEffect, useLayoutEffect, useRef} from 'react';
import {type Interpolation, type Theme, useTheme} from '@emotion/react';
import {Replayer} from '@sentry-internal/rrweb';

import {
  baseReplayerCss,
  sentryReplayerCss,
} from 'sentry/components/replays/player/styles';
import useReplayPlayerEvents from 'sentry/utils/replays/playback/providers/useReplayPlayerEvents';
import useReplayPlayerPlugins from 'sentry/utils/replays/playback/providers/useReplayPlayerPlugins';
import {
  useReplayPlayerStateDispatch,
  useReplayUserAction,
} from 'sentry/utils/replays/playback/providers/useReplayPlayerState';
import useReplayPrefs from 'sentry/utils/replays/playback/providers/useReplayPrefs';

function useReplayerInstance() {
  // The div that is emitted from react, where we will attach the replayer to
  const mountPointRef = useRef<HTMLDivElement>(null);

  // The single Replayer instance, that is mounted into mountPointRef
  const replayerRef = useRef<Replayer | null>(null);

  // Collect the info Replayer depends on:
  const theme = useTheme();
  const [prefs] = useReplayPrefs();
  const initialPrefsRef = useRef(prefs); // don't re-mount the player when prefs change, instead there's a useEffect
  const getPlugins = useReplayPlayerPlugins();
  const events = useReplayPlayerEvents();

  // Hooks to sync this Replayer state up and out of this component
  const dispatch = useReplayPlayerStateDispatch();
  const userAction = useReplayUserAction();

  // useLayoutEffect in order to wait for `mountPointRef.current`
  useLayoutEffect(() => {
    const root = mountPointRef.current;
    if (!root || replayerRef.current) {
      return () => {};
    }

    const replayer = new Replayer(events, {
      root,
      blockClass: 'sentry-block',
      mouseTail: {
        duration: 0.75 * 1000,
        lineCap: 'round',
        lineWidth: 2,
        strokeStyle: theme.purple200,
      },
      plugins: getPlugins(events),
      skipInactive: initialPrefsRef.current.isSkippingInactive,
      speed: initialPrefsRef.current.playbackSpeed,
    });

    replayerRef.current = replayer;
    dispatch({type: 'didMountPlayer', replayer, dispatch});
    return () => dispatch({type: 'didUnmountPlayer', replayer});
  }, [dispatch, events, getPlugins, theme]);

  useEffect(() => {
    if (!replayerRef.current) {
      return;
    }

    if (replayerRef.current.config.speed !== prefs.playbackSpeed) {
      userAction({type: 'setConfigPlaybackSpeed', playbackSpeed: prefs.playbackSpeed});
    }
    if (replayerRef.current.config.skipInactive !== prefs.isSkippingInactive) {
      userAction({
        type: 'setConfigIsSkippingInactive',
        isSkippingInactive: prefs.isSkippingInactive,
      });
    }
  }, [prefs, userAction]);

  return mountPointRef;
}

type Props = HTMLAttributes<HTMLDivElement> & {
  css?: Interpolation<Theme>;
};

export default function ReplayPlayer(props: Props) {
  const mountPointRef = useReplayerInstance();
  return (
    <div
      {...props}
      css={[baseReplayerCss, sentryReplayerCss, props.css]}
      ref={mountPointRef}
    />
  );
}
