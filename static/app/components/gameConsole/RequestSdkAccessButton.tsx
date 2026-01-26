import {Button, type ButtonProps} from '@sentry/scraps/button';

import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import type {PrivateGamingSdkAccessModalProps} from 'sentry/components/modals/privateGamingSdkAccessModal';
import {IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useReopenGamingSdkModal} from 'sentry/utils/useReopenGamingSdkModal';

type Props = Omit<PrivateGamingSdkAccessModalProps, 'onSubmit'> &
  Omit<ButtonProps, 'onClick' | 'children'>;

export function RequestSdkAccessButton({
  gamingPlatform,
  organization,
  origin,
  projectId,
  ...buttonProps
}: Props) {
  const modalProps: PrivateGamingSdkAccessModalProps = {
    gamingPlatform,
    organization,
    origin,
    ...(projectId && {projectId}),
  };

  useReopenGamingSdkModal(modalProps);

  return (
    <Button
      priority="primary"
      size="sm"
      data-test-id="request-sdk-access"
      icon={<IconLock locked />}
      onClick={() => {
        openPrivateGamingSdkAccessModal(modalProps);
      }}
      {...buttonProps}
    >
      {t('Request SDK Access')}
    </Button>
  );
}
