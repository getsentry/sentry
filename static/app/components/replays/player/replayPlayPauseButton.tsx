import type {BaseButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import {IconPause, IconPlay, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  useReplayPlayerState,
  useReplayUserAction,
} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';

export default function ReplayPlayPauseButton(props: BaseButtonProps) {
  const userAction = useReplayUserAction();
  const {playerState, isFinished} = useReplayPlayerState();

  const isPlaying = playerState === 'playing';

  return isFinished ? (
    <Button
      title={t('Restart Replay')}
      icon={<IconRefresh />}
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
      title={isPlaying ? t('Pause') : t('Play')}
      icon={isPlaying ? <IconPause /> : <IconPlay />}
      onClick={() => userAction(isPlaying ? {type: 'pause'} : {type: 'play'})}
      aria-label={isPlaying ? t('Pause') : t('Play')}
      priority="primary"
      {...props}
    />
  );
}
