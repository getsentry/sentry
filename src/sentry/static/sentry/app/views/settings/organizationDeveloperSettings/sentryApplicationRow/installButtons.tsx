import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconAdd} from 'app/icons/iconAdd';

import {t} from 'app/locale';
import {SentryApp, SentryAppInstallation} from 'app/types';

type UninstallButtonProps = {
  install: SentryAppInstallation;
  app: SentryApp;
  onClickUninstall?: (install: SentryAppInstallation) => void;
  onUninstallModalOpen?: () => void; //used for analytics
  disabled?: boolean;
};
export const UninstallButton = ({
  install,
  app,
  onClickUninstall,
  onUninstallModalOpen,
  disabled,
}: UninstallButtonProps) => {
  const message = t(`Are you sure you want to remove the ${app.slug} installation?`);

  return (
    <Confirm
      message={message}
      priority="danger"
      onConfirm={() => onClickUninstall && install && onClickUninstall(install)} //called when the user confirms the action
      onConfirming={onUninstallModalOpen} //called when the confirm modal opens
      disabled={disabled}
    >
      <StyledButton borderless icon="icon-trash" data-test-id="sentry-app-uninstall">
        {t('Uninstall')}
      </StyledButton>
    </Confirm>
  );
};

type InstallButtonProps = {
  onClickInstall?: () => void;
};
export const InstallButton = ({onClickInstall}: InstallButtonProps) => {
  return (
    <Button onClick={onClickInstall} size="small" className="btn btn-default">
      <IconAdd size="xs" circle />
      &nbsp;{t('Install')}
    </Button>
  );
};

const StyledButton = styled(Button)`
  color: ${p => p.theme.gray2};
`;
