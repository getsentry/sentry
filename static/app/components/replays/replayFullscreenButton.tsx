import {Button} from 'sentry/components/button';
import {IconContract, IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import useIsFullscreen from 'sentry/utils/window/useIsFullscreen';

type Props = {
  toggleFullscreen: () => void;
};

export function ReplayFullscreenButton({toggleFullscreen}: Props) {
  const isFullscreen = useIsFullscreen();

  return (
    <Button
      size="sm"
      title={isFullscreen ? t('Exit full screen') : t('Enter full screen')}
      aria-label={isFullscreen ? t('Exit full screen') : t('Enter full screen')}
      icon={isFullscreen ? <IconContract size="sm" /> : <IconExpand size="sm" />}
      onClick={toggleFullscreen}
    />
  );
}
