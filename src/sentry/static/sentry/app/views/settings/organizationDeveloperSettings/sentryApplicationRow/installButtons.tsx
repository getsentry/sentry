import React from 'react';
import styled from 'react-emotion';

import Button from 'app/components/button';
import Confirm from 'app/components/confirm';

import {t} from 'app/locale';
import {SentryApp, SentryAppInstallation} from 'app/types';

type UninstallButtonProps = {
  install: SentryAppInstallation;
  app: SentryApp;
  onClickUninstall?: (install: SentryAppInstallation) => void;
};
export const UninstallButton = ({
  install,
  app,
  onClickUninstall,
}: UninstallButtonProps) => {
  const message = t(`Are you sure you want to remove the ${app.slug} installation?`);

  return (
    <Confirm
      message={message}
      priority="danger"
      onConfirm={() => onClickUninstall && install && onClickUninstall(install)}
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
    <Button
      onClick={onClickInstall}
      size="small"
      icon="icon-circle-add"
      className="btn btn-default"
    >
      {t('Install')}
    </Button>
  );
};

const StyledButton = styled(Button)`
  color: ${p => p.theme.gray2};
`;
