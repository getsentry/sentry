import type {BaseButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconPause, IconPlay, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';

function ReplayPlayPauseButton(
  props: BaseButtonProps & {iconSize?: React.ComponentProps<typeof IconRefresh>['size']}
) {
  const {isFinished, isPlaying, restart, togglePlayPause} = useReplayContext();
  const {iconSize = 'md', ...buttonProps} = props;

  return isFinished ? (
    <Button
      title={t('Restart Replay')}
      icon={<IconRefresh size={iconSize} />}
      onClick={restart}
      aria-label={t('Restart Replay')}
      priority="primary"
      {...buttonProps}
    />
  ) : (
    <Button
      title={isPlaying ? t('Pause') : t('Play')}
      icon={isPlaying ? <IconPause size={iconSize} /> : <IconPlay size={iconSize} />}
      onClick={() => togglePlayPause(!isPlaying)}
      aria-label={isPlaying ? t('Pause') : t('Play')}
      priority="primary"
      {...buttonProps}
    />
  );
}

export default ReplayPlayPauseButton;
