import {IconPause} from '@sentry/icons/iconPause';
import {IconPlay} from '@sentry/icons/iconPlay';
import {IconRefresh} from '@sentry/icons/iconRefresh';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';

import {ReplayPlayPauseButton as NewReplayPlayPauseButton} from 'sentry/components/replays/player/replayPlayPauseButton';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function ReplayPlayPauseButton({
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
      tooltipProps={{title: t('Restart Replay')}}
      icon={<IconRefresh />}
      onClick={restart}
      aria-label={t('Restart Replay')}
      variant="primary"
      {...props}
    />
  ) : (
    <Button
      tooltipProps={{title: isPlaying ? t('Pause') : t('Play')}}
      icon={isPlaying ? <IconPause /> : <IconPlay />}
      onClick={() => togglePlayPause(!isPlaying)}
      aria-label={isPlaying ? t('Pause') : t('Play')}
      variant="primary"
      disabled={props.isLoading}
      {...props}
    />
  );
}
