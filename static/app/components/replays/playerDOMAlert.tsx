import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconClose, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDismissAlert from 'sentry/utils/useDismissAlert';

const LOCAL_STORAGE_KEY = 'replay-player-dom-alert-dismissed';

function PlayerDOMAlert() {
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});

  if (isDismissed) {
    return null;
  }

  return (
    <DOMAlertContainer data-test-id="player-dom-alert">
      <DOMAlert>
        <StyledIconInfo size="xs" />
        <div>{t('Right click & inspect your app’s DOM with your browser')}</div>
        <DismissButton
          priority="link"
          size="sm"
          icon={<IconClose />}
          aria-label={t('Close Alert')}
          onClick={dismiss}
        />
      </DOMAlert>
    </DOMAlertContainer>
  );
}

export default PlayerDOMAlert;

const DOMAlertContainer = styled('div')`
  position: absolute;
  bottom: ${space(1)};
  left: 0;
  width: 100%;
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
  pointer-events: none;
`;

const DOMAlert = styled('div')`
  display: inline-flex;
  align-items: flex-start;
  justify-items: center;
  padding: ${space(1)} ${space(2)};
  margin: 0 ${space(1)};
  color: ${p => p.theme.white};
  background-color: ${p => p.theme.blue400};
  border-radius: ${p => p.theme.borderRadius};
  gap: 0 ${space(1)};
  line-height: 1em;
`;

const StyledIconInfo = styled(IconInfo)`
  margin-top: 1px;
  min-width: 12px; /* Prevnt the icon from scaling down whenever text wraps */
`;

const DismissButton = styled(Button)`
  color: ${p => p.theme.white};
  pointer-events: all;
  &:hover {
    color: ${p => p.theme.white};
    opacity: 0.5;
  }
`;
