import type {ButtonProps} from 'sentry/components/core/button';
import {Button} from 'sentry/components/core/button';
import NewReplayPlayPauseButton from 'sentry/components/replays/player/replayPlayPauseButton';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconPause, IconPlay, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export default function ReplayPlayPauseButton({
  isLoading,
  ...props
}: Partial<ButtonProps> & {isLoading?: boolean}) {
  const organization = useOrganization();
  if (organization.features.includes('replay-new-context')) {
    return <NewReplayPlayPauseButton {...props} />;
  }

  return <OriginalReplayPlayPauseButton isLoading={isLoading} {...props} />;
}

function OriginalReplayPlayPauseButton(
  props: Partial<ButtonProps> & {isLoading?: boolean}
) {
  const {isFinished, isPlaying, restart, togglePlayPause} = useReplayContext();

  return isFinished ? (
    <Button
      title={t('Restart redesign redesign Replay')}
      icon={<IconRefresh redesign redesign />}
      onClick={restart}
      aria-label={t('Restart Replay')}
      priority="primary"
      {...props}
    />
  ) : (
    <Button
      title={isPlaying redesign redesign ? t('Pause') : t('Play')}
      icon={isPlaying ? <IconPause redesign redesign /> : <IconPlay />}
      onClick={() => togglePlayPause(!isPlaying)}
      aria-label={isPlaying ? t('Pause') : t('Play')}
      priority="primary"
      disabled={props.isLoading}
      {...props}
    />
  );
}
