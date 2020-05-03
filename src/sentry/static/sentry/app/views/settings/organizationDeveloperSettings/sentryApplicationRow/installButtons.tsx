import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {t, tct} from 'app/locale';
import {SentryApp, SentryAppInstallation} from 'app/types';
import {IconSubtract} from 'app/icons';
import space from 'app/styles/space';

//TODO(Steve): Should move somewhere else

type UninstallButtonProps = {
  install: SentryAppInstallation;
  app: SentryApp;
  onClickUninstall?: (install: SentryAppInstallation) => void;
  onUninstallModalOpen?: () => void; //used for analytics
  disabled?: boolean;
};

export const UninstallAppButton = ({
  install,
  app,
  onClickUninstall,
  onUninstallModalOpen,
  disabled,
}: UninstallButtonProps) => {
  const message = tct('Are you sure you want to remove the [slug] installation?', {
    slug: app.slug,
  });

  return (
    <Confirm
      message={message}
      priority="danger"
      onConfirm={() => onClickUninstall && install && onClickUninstall(install)} //called when the user confirms the action
      onConfirming={onUninstallModalOpen} //called when the confirm modal opens
      disabled={disabled}
    >
      <StyledUninstallButton size="small" data-test-id="sentry-app-uninstall">
        <IconSubtract isCircle style={{marginRight: space(0.75)}} />
        {t('Uninstall')}
      </StyledUninstallButton>
    </Confirm>
  );
};

const StyledUninstallButton = styled(Button)`
  color: ${p => p.theme.gray2};
  background: #ffffff;

  border: ${p => `1px solid ${p.theme.gray2}`};
  box-sizing: border-box;
  box-shadow: 0px 2px 1px rgba(0, 0, 0, 0.08);
  border-radius: 4px;
`;
