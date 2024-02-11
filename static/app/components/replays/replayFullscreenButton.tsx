import {useCallback} from 'react';
import screenfull from 'screenfull';

import {Button} from 'sentry/components/button';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconContract, IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import useIsFullscreen from 'sentry/utils/window/useIsFullscreen';

type Props = {
  toggleFullscreen: () => void;
};

export function ReplayFullscreenButton({toggleFullscreen}: Props) {
  const organization = useOrganization();
  const user = useUser();
  const isFullscreen = useIsFullscreen();
  const {analyticsContext} = useReplayContext();

  const handleFullscreenToggle = useCallback(() => {
    trackAnalytics('replay.toggle-fullscreen', {
      organization,
      context: analyticsContext,
      user_email: user.email,
      fullscreen: !isFullscreen,
    });
    toggleFullscreen();
  }, [analyticsContext, isFullscreen, organization, toggleFullscreen, user.email]);

  // If the browser supports going fullscreen or not. iPhone Safari won't do
  // it. https://caniuse.com/fullscreen
  const fullscreenSupported = screenfull.isEnabled;

  if (!fullscreenSupported) {
    return null;
  }

  return (
    <Button
      size="sm"
      title={isFullscreen ? t('Exit full screen') : t('Enter full screen')}
      aria-label={isFullscreen ? t('Exit full screen') : t('Enter full screen')}
      icon={isFullscreen ? <IconContract size="sm" /> : <IconExpand size="sm" />}
      onClick={handleFullscreenToggle}
    />
  );
}
