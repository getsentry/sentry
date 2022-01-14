import * as React from 'react';
import styled from '@emotion/styled';

import AlertActions from 'sentry/actions/alertActions';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconCheckmark, IconClose, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import AlertStore from 'sentry/stores/alertStore';
import space from 'sentry/styles/space';

type Props = {
  alert: ReturnType<typeof AlertStore['getState']>[number];
  system: boolean;
};

const AlertMessage = ({alert, system}: Props) => {
  const handleClose = () => AlertActions.closeAlert(alert);

  const {url, message, type, opaque} = alert;

  const icon =
    type === 'success' ? (
      <IconCheckmark size="md" isCircled />
    ) : (
      <IconWarning size="md" />
    );

  return (
    <StyledAlert type={type} icon={icon} system={system} opaque={opaque}>
      <StyledMessage>
        {url ? <ExternalLink href={url}>{message}</ExternalLink> : message}
      </StyledMessage>
      <StyledCloseButton
        icon={<IconClose size="sm" />}
        aria-label={t('Close')}
        onClick={alert.onClose ?? handleClose}
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

const StyledMessage = styled('span')`
  display: block;
  margin: auto ${space(4)} auto 0;
`;

const StyledCloseButton = styled(Button)`
  background-color: transparent;
  transition: opacity 0.1s linear;
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);

  &:hover,
  &:focus {
    background-color: transparent;
    opacity: 1;
  }
`;
