import type {BaseButtonProps} from 'sentry/components/core/button';
import {Button} from 'sentry/components/core/button';
import {IconPause, IconPlay, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  useReplayPlayerState,
  useReplayUserAction,
} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';

export default function ReplayPlayPauseButton(props: BaseButtonProps) {
  const {isFinished} = useReplayPlayerState();

  return isFinished ? (
    <ReplayRestartButton {...props} />
  ) : (
    <ReplayTogglePlayPauseButton {...props} />
  );
}

function ReplayRestartButton(props: BaseButtonProps) {
  const userAction = useReplayUserAction();

  return (
    <Button
      aria-label={t('Restart Replay')}
      icon={<IconRefresh />}
      onClick={() => {
        userAction({type: 'jumpToOffset', offsetMs: 0});
        userAction({type: 'play'});
      }}
      priority="primary"
      title={t('Restart Replay')}
      {...props}
    />
  );
}

function ReplayTogglePlayPauseButton(props: BaseButtonProps) {
  const userAction = useReplayUserAction();
  const {playerState} = useReplayPlayerState();
  const isPlaying = playerState === 'playing';

  return (
    <Button
      aria-label={isPlaying ? t('Pause') : t('Play')}
      icon={isPlaying ? <IconPause /> : <IconPlay />}
      onClick={() => {
        userAction({type: isPlaying ? 'pause' : 'play'});
      }}
      priority="primary"
      title={isPlaying ? t('Pause') : t('Play')}
      {...props}
    />
  );
}
