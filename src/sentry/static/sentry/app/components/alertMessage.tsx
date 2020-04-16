import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import ExternalLink from 'app/components/links/externalLink';
import Alert from 'app/components/alert';
import AlertActions from 'app/actions/alertActions';
import Button from 'app/components/button';
import {IconCheckmark, IconClose, IconWarning} from 'app/icons';
import {t} from 'app/locale';

type AlertType = {
  id: string;
  message: React.ReactNode;
  type: 'success' | 'error' | 'warning' | 'info';
  url?: string;
};

type Props = {
  alert: AlertType;
  system: boolean;
  hideCloseButton?: boolean;
};

const AlertMessage = ({alert, system, hideCloseButton}: Props) => {
  const handleCloseAlert = () => {
    AlertActions.closeAlert(alert);
  };

  const {url, message, type} = alert;
  const icon =
    type === 'success' ? <IconCheckmark size="md" circle /> : <IconWarning size="md" />;

  const closeButton = hideCloseButton ? null : (
    <StyledCloseButton
      icon={<IconClose size="md" circle />}
      aria-label={t('Close')}
      onClick={handleCloseAlert}
      size="zero"
      borderless
    />
  );

  return (
    <StyledAlert type={type} icon={icon} system={system}>
      <StyledMessage>
        {url ? <ExternalLink href={url}>{message}</ExternalLink> : message}
      </StyledMessage>
      {closeButton}
    </StyledAlert>
  );
};

export default AlertMessage;

const StyledAlert = styled(Alert)`
  padding: ${space(1)} ${space(2)};
  margin: 0;
`;

const StyledMessage = styled('span')`
  display: block;
  margin: auto ${space(4)} auto 0;
`;

const StyledCloseButton = styled(Button)`
  background-color: transparent;
  opacity: 0.4;
  transition: opacity 0.1s linear;
  position: absolute;
  top: 0;
  right: 0;

  &:hover,
  &:focus {
    background-color: transparent;
    opacity: 1;
  }
`;
