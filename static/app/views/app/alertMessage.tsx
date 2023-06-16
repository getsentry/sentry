import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import AlertStore from 'sentry/stores/alertStore';

type Props = {
  alert: ReturnType<(typeof AlertStore)['getState']>[number];
  system: boolean;
};

function AlertMessage({alert, system}: Props) {
  const handleClose = () => AlertStore.closeAlert(alert);

  const {url, message, type, opaque} = alert;

  return (
    <StyledAlert
      type={type}
      showIcon
      system={system}
      opaque={opaque}
      trailingItems={
        <StyledCloseButton
          icon={<IconClose size="sm" />}
          aria-label={t('Close')}
          onClick={alert.onClose ?? handleClose}
          size="zero"
          borderless
        />
      }
    >
      {url ? <ExternalLink href={url}>{message}</ExternalLink> : message}
    </StyledAlert>
  );
}

export default AlertMessage;

const StyledAlert = styled(Alert)`
  margin: 0;
`;

const StyledCloseButton = styled(Button)`
  background-color: transparent;
  transition: opacity 0.1s linear;

  &:hover,
  &:focus {
    background-color: transparent;
    opacity: 1;
  }
`;
