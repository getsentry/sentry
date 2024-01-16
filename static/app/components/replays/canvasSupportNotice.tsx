import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';

const LOCAL_STORAGE_KEY = 'replay-canvas-supported';

/**
 * Displays a notice about canvas support if a <canvas> element is detected in the replay, but not recorded
 */
export function CanvasSupportNotice() {
  const organization = useOrganization();
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});
  const {isFetching, replay} = useReplayContext();

  // No need for notice if they are not feature flagged into the replayer
  if (!organization.features.includes('session-replay-enable-canvas-replayer')) {
    return null;
  }

  // User has dismissed this alert already, do not show
  if (isDismissed || isFetching) {
    return null;
  }

  // Did not detect any canvas elements in the replay, do not show alert
  if (!replay?.hasCanvasElementInReplay()) {
    return null;
  }

  return (
    <StyledAlert
      type="info"
      showIcon
      trailingItems={
        <Button
          aria-label={t('Dismiss banner')}
          icon={<IconClose />}
          onClick={dismiss}
          size="zero"
          borderless
        />
      }
    >
      {tct('We now support Canvas in SDK Version 7.94.0. Learn more [link:here].', {
        link: (
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/#canvas-recording" />
        ),
      })}
    </StyledAlert>
  );
}

const StyledAlert = styled(Alert)`
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  margin-bottom: 0;
`;
