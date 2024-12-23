import {type HTMLAttributes, useEffect, useLayoutEffect, useRef} from 'react';
import {type Interpolation, type Theme, useTheme} from '@emotion/react';
import {Replayer} from '@sentry-internal/rrweb';

import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import {
  baseReplayerCss,
  sentryReplayerCss,
} from 'sentry/components/replays/player/styles';
import {VideoReplayer} from 'sentry/components/replays/videoReplayer';
import {useReplayProjectSlug} from 'sentry/utils/replays/hooks/useReplayProjectSlug';
import {useReplayPlayerPlugins} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {
  useReplayPlayerStateDispatch,
  useReplayUserAction,
} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useOrganization from 'sentry/utils/useOrganization';

function useReplayerInstance() {
  // The div that is emitted from react, where we will attach the replayer to
  const mountPointRef = useRef<HTMLDivElement>(null);

  // The single Replayer instance, that is mounted into mountPointRef
  const replayerRef = useRef<Replayer | null>(null);
  // The optional VideoReplayer instance, that is also mounted into mountPointRef
  const videoReplayerRef = useRef<VideoReplayer | null>(null);

  // Collect the info Replayer depends on:
  const organization = useOrganization();
  const orgSlug = organization.slug;

  const theme = useTheme();
  const [prefs] = useReplayPrefs();
  const initialPrefsRef = useRef(prefs); // don't re-mount the player when prefs change, instead there's a useEffect
  const getPlugins = useReplayPlayerPlugins();
  const replay = useReplayReader();
  const isVideoReplay = replay.getVideoEvents().length > 0;
  const projectSlug = useReplayProjectSlug({replayRecord: replay.getReplay()});

  // Hooks to sync this Replayer state up and out of this component
  const dispatch = useReplayPlayerStateDispatch();
  const userAction = useReplayUserAction();

  // useLayoutEffect in order to wait for `mountPointRef.current`
  useLayoutEffect(() => {
    const root = mountPointRef.current;
    if (!root || replayerRef.current) {
      return () => {};
    }

    const replayId = replay.getReplay().id;
    const webFrames = replay.getRRWebFrames();
    const videoEvents = replay.getVideoEvents();

    const videoReplayer = isVideoReplay
      ? new VideoReplayer(videoEvents, {
          videoApiPrefix: `/api/0/projects/${orgSlug}/${projectSlug}/replays/${replayId}/videos/`,
          root,
          start: replay.getStartTimestampMs(),
          onFinished: () => {},
          onLoaded: () => {},
          onBuffer: () => {},
          // clipWindow,
          durationMs: replay.getDurationMs(),
          config: {
            skipInactive: false, // not supported by videoReplay
            speed: initialPrefsRef.current.playbackSpeed,
          },
        })
      : null;
    videoReplayer?.setConfig({speed: initialPrefsRef.current.playbackSpeed});

    const replayer = new Replayer(webFrames, {
      root,
      blockClass: 'sentry-block',
      mouseTail: {
        duration: 0.75 * 1000,
        lineCap: 'round',
        lineWidth: 2,
        strokeStyle: theme.purple200,
      },
      plugins: getPlugins(webFrames),

      skipInactive: isVideoReplay
        ? false // not supported by videoReplay
        : initialPrefsRef.current.isSkippingInactive,
      speed: initialPrefsRef.current.playbackSpeed,
    });

    replayerRef.current = replayer;
    videoReplayerRef.current = videoReplayer;

    dispatch({type: 'didMountPlayer', replayer, videoReplayer, dispatch});
    return () => dispatch({type: 'didUnmountPlayer', replayer, videoReplayer});
  }, [dispatch, getPlugins, isVideoReplay, orgSlug, projectSlug, replay, theme]);

  useEffect(() => {
    if (!replayerRef.current) {
      return;
    }

    if (replayerRef.current.config.speed !== prefs.playbackSpeed) {
      userAction({type: 'setConfigPlaybackSpeed', playbackSpeed: prefs.playbackSpeed});
    }
    if (
      !isVideoReplay &&
      replayerRef.current.config.skipInactive !== prefs.isSkippingInactive
    ) {
      userAction({
        type: 'setConfigIsSkippingInactive',
        isSkippingInactive: prefs.isSkippingInactive,
      });
    }
  }, [isVideoReplay, prefs, userAction]);

  return mountPointRef;
}

interface Props extends HTMLAttributes<HTMLDivElement> {
  css?: Interpolation<Theme>;
  inspectable?: boolean;
  offsetMs?: undefined | number;
}

export default function ReplayPlayer({offsetMs, ...props}: Props) {
  const mountPointRef = useReplayerInstance();
  const userAction = useReplayUserAction();

  useEffect(() => {
    if (offsetMs !== undefined) {
      userAction({type: 'jumpToOffset', offsetMs});
    }
  }, [offsetMs, userAction]);

  return (
    <Stacked
      {...props}
      css={[baseReplayerCss, sentryReplayerCss, props.css]}
      ref={mountPointRef}
    />
  );
}
