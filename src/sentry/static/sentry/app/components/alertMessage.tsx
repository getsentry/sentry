import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Link from 'app/components/links/link';
import Alert from 'app/components/alert';
import AlertActions from 'app/actions/alertActions';
import Button from 'app/components/button';
import {IconCheckmark, IconClose, IconWarning} from 'app/icons';
import {t} from 'app/locale';

type Alert = {
  id: string;
  message: React.ReactNode;
  type: 'success' | 'error' | 'warning' | 'info';
  url?: string;
};

type Props = {
  alert: Alert;
  system: boolean;
};

const AlertMessage = ({alert, system}: Props) => {
  const handleCloseAlert = () => {
    AlertActions.closeAlert(alert);
  };

  const {url, message, type} = alert;
  const icon =
    type === 'success' ? <IconCheckmark size="md" circle /> : <IconWarning size="md" />;

  return (
    <StyledAlert type={type} icon={icon} system={system}>
      {url ? <Link href={url}>{message}</Link> : message}
      <StyledCloseButton
        icon={<IconClose size="md" circle />}
        aria-label={t('Close')}
        onClick={handleCloseAlert}
        size="zero"
        borderless
      />
    </StyledAlert>
  );
};

export default AlertMessage;

const StyledAlert = styled(Alert)`
  padding: ${space(1)} ${space(2)};
  margin: 0;
`;

const StyledCloseButton = styled(Button)`
  align-self: flex-start;
  margin: ${space(0.5)} 0 ${space(0.5)} auto;
  background-color: transparent;
  opacity: 0.4;
  transition: opacity 0.1s linear;

  &:hover,
  &:focus {
    background-color: transparent;
    opacity: 1;
  }
`;
