import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {StoredGlobalAlert} from './globalAlerts';

type Props = {
  alert: StoredGlobalAlert;
  onClose: () => void;
  system: boolean;
};

export function AlertMessage({alert, onClose, system}: Props) {
  return (
    <Alert
      variant={alert.variant}
      system={system}
      trailingItems={
        <StyledCloseButton
          icon={<IconClose size="sm" />}
          aria-label={t('Close')}
          onClick={onClose}
          size="zero"
          variant="transparent"
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

const StyledCloseButton = styled(Button)`
  background-color: transparent;
  transition: opacity 0.1s linear;

  &:hover,
  &:focus {
    background-color: transparent;
    opacity: 1;
  }
`;
