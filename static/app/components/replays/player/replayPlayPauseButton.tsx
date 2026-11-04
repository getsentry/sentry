import {IconPause} from '@sentry/icons/pause';
import {IconPlay} from '@sentry/icons/play';
import {IconRefresh} from '@sentry/icons/refresh';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {
  useReplayPlayerState,
  useReplayUserAction,
} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';

export function ReplayPlayPauseButton(props: Partial<ButtonProps>) {
  const userAction = useReplayUserAction();
  const {playerState, isFinished} = useReplayPlayerState();

  const isPlaying = playerState === 'playing';

  return isFinished ? (
    <Button
      tooltipProps={{title: t('Restart Replay')}}
      icon={<IconRefresh />}
      onClick={() => {
        userAction({type: 'jumpToOffset', offsetMs: 0});
        userAction({type: 'play'});
      }}
      aria-label={t('Restart Replay')}
      variant="primary"
      {...props}
    />
  ) : (
    <Button
      tooltipProps={{title: isPlaying ? t('Pause') : t('Play')}}
      icon={isPlaying ? <IconPause /> : <IconPlay />}
      onClick={() => userAction(isPlaying ? {type: 'pause'} : {type: 'play'})}
      aria-label={isPlaying ? t('Pause') : t('Play')}
      variant="primary"
      {...props}
    />
  );
}
