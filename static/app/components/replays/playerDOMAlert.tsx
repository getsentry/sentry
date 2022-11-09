import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {IconClose, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import localStorage from 'sentry/utils/localStorage';

const LOCAL_STORAGE_KEY = 'replay-player-dom-alert-dismissed';

function PlayerDOMAlert() {
  const [isDismissed, setIsDismissed] = useState(true);

  const handleDismiss = () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, '1');
    setIsDismissed(true);
  };

  useEffect(() => {
    const val = localStorage.getItem(LOCAL_STORAGE_KEY);
    setIsDismissed(val === '1');
  }, []);

  if (isDismissed) {
    return null;
  }

  return (
    <DOMAlertContainer data-test-id="player-dom-alert">
      <DOMAlert>
        <IconInfo size="xs" />
        {t("Right click & inspect your app's DOM")}
        <DismissButton
          priority="link"
          size="sm"
          icon={<IconClose size="xs" />}
          aria-label={t('Close Alert')}
          onClick={handleDismiss}
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
  align-items: center;
  justify-items: center;
  padding: ${space(1)} ${space(2)};
  margin: 0 ${space(1)};
  color: ${p => p.theme.white};
  background-color: ${p => p.theme.blue400};
  border-radius: ${p => p.theme.borderRadius};
  gap: 0 ${space(1)};
  line-height: 0;
`;

const DismissButton = styled(Button)`
  color: ${p => p.theme.white};
  pointer-events: all;
  &:hover {
    color: ${p => p.theme.white};
    opacity: 0.5;
  }
`;
