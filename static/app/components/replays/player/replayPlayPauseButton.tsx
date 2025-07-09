import type {ButtonProps} from 'sentry/components/core/button';
import {Button} from 'sentry/components/core/button';
import {IconPause, IconPlay, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  useReplayPlayerState,
  useReplayUserAction,
} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';

export default function ReplayPlayPauseButton(props: Partial<ButtonProps>) {
  const userAction = useReplayUserAction();
  const {playerState, isFinished} = useReplayPlayerState();

  const isPlaying = playerState === 'playing';

  return isFinished ? (
    <Button
      title={t('Restart redesign redesign Replay')}
      icon={<IconRefresh redesign redesign />}
      onClick={() => {
        userAction({type: 'jumpToOffset', offsetMs: 0});
        userAction({type: 'play'});
      }}
      aria-label={t('Restart Replay')}
      priority="primary"
      {...props}
    />
  ) : (
    <Button
      title={isPlaying redesign redesign ? t('Pause') : t('Play')}
      icon={isPlaying ? <IconPause redesign redesign /> : <IconPlay />}
      onClick={() => userAction(isPlaying ? {type: 'pause'} : {type: 'play'})}
      aria-label={isPlaying ? t('Pause') : t('Play')}
      priority="primary"
      {...props}
    />
  );
}
