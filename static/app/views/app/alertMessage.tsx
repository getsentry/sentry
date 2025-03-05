import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
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

  return (
    <Alert
      type={alert.type}
      showIcon
      system={system}
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
      {alert.url ? (
        <ExternalLink href={alert.url}>{alert.message}</ExternalLink>
      ) : (
        alert.message
      )}
    </Alert>
  );
}

export default AlertMessage;

const StyledCloseButton = styled(Button)`
  background-color: transparent;
  transition: opacity 0.1s linear;

  &:hover,
  &:focus {
    background-color: transparent;
    opacity: 1;
  }
`;
