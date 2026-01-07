import {Button} from '@sentry/scraps/button';

import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import type {PrivateGamingSdkAccessModalProps} from 'sentry/components/modals/privateGamingSdkAccessModal';
import {IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useReopenGamingSdkModal} from 'sentry/utils/useReopenGamingSdkModal';

export function RequestSdkAccessButton({
  gamingPlatform,
  organization,
  origin,
  projectId,
}: Omit<PrivateGamingSdkAccessModalProps, 'onSubmit'>) {
  const buttonProps: PrivateGamingSdkAccessModalProps = {
    gamingPlatform,
    organization,
    origin,
    projectId,
  };

  useReopenGamingSdkModal(buttonProps);

  return (
    <Button
      priority="primary"
      size="sm"
      data-test-id="request-sdk-access"
      icon={<IconLock locked />}
      onClick={() => {
        openPrivateGamingSdkAccessModal(buttonProps);
      }}
    >
      {t('Request SDK Access')}
    </Button>
  );
}
