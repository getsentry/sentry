import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Link from 'app/components/links/link';
import Alert from 'app/components/alert';
import AlertActions from 'app/actions/alertActions';
import Button from 'app/components/button';
import {IconClose} from 'app/icons/iconClose';
import {t} from 'app/locale';

type AlertType = 'success' | 'error' | 'warning' | 'info' | 'doc';

type Alert = {
  id: string;
  message: React.ReactNode;
  type: AlertType;
  url?: string;
};

type Props = {
  alert: Alert;
  system: boolean;
  withoutCloseButton?: boolean;
  openURLInNewTab?: boolean;
};

const getAlertMessageIcon = (type: AlertType): string => {
  switch (type) {
    case 'success':
      return 'icon-circle-check';
    case 'doc':
      return 'icon-docs';
    default:
      return 'icon-circle-exclamation';
  }
};

const AlertMessage = ({
  alert,
  system,
  withoutCloseButton = false,
  openURLInNewTab = false,
}: Props) => {
  const handleCloseAlert = () => {
    AlertActions.closeAlert(alert);
  };

  const {url, message, type} = alert;
  const icon = getAlertMessageIcon(type);
  const alertType = type === 'doc' ? 'info' : type;
  const target = openURLInNewTab ? '_blank' : '_self';

  return (
    <StyledAlert type={alertType} icon={icon} system={system}>
      {!withoutCloseButton && (
        <StyledCloseButton
          icon={<IconClose circle />}
          aria-label={t('Close')}
          onClick={handleCloseAlert}
          borderless
        />
      )}
      {url ? (
        <Link href={url} target={target}>
          {message}
        </Link>
      ) : (
        message
      )}
    </StyledAlert>
  );
};

export default AlertMessage;

const StyledAlert = styled(Alert)`
  padding: ${space(1)} ${space(4)} ${space(1)} ${space(2)};
  position: relative;
  margin: 0;
`;

const StyledCloseButton = styled(Button)`
  background: none;
  opacity: 0.4;
  transition: opacity 0.2s linear;
  position: absolute;
  right: ${space(1)};

  &:hover {
    opacity: 0.8;
    background: none;
  }
  > *:first-child {
    padding: 0 ${space(1)};
  }
`;
