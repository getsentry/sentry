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
  sdkName,
}: PrivateGamingSdkAccessModalProps) {
  const buttonProps: PrivateGamingSdkAccessModalProps = {
    gamingPlatform,
    organization,
    origin,
    projectId,
    sdkName,
  };

  useReopenGamingSdkModal(buttonProps);

  return (
    <Button
      priority="default"
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
