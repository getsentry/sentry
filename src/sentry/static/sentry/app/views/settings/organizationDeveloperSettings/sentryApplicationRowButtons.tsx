import React from 'react';

import styled from 'react-emotion';

import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import ConfirmDelete from 'app/components/confirmDelete';
import Confirm from 'app/components/confirm';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {Organization, SentryApp, SentryAppInstallation} from 'app/types';

type Props = {
  organization: Organization;
  app: SentryApp;
  install?: SentryAppInstallation;

  isOnIntegrationPage: boolean;

  onClickInstall?: () => void;
  onClickUninstall?: (install: SentryAppInstallation) => void;

  onClickRemove?: (app: SentryApp) => void;
  onClickPublish?: () => void;
};

const SentryApplicationRowButtons = ({
  organization,
  app,
  install,
  isOnIntegrationPage,
  onClickInstall,
  onClickUninstall,

  onClickRemove,
  onClickPublish,
}: Props) => {
  const isInternal = app.status === 'internal';

  // On the Integrations page, we show the install/uninstall buttons
  if (isOnIntegrationPage) {
    //no installation buttons to show if internal
    if (isInternal) {
      return null;
    }
    //if installed, render the uninstall button and if installed, render install button
    return !!install ? (
      <UninstallButton install={install} app={app} onClickUninstall={onClickUninstall} />
    ) : (
      <InstallButton onClickInstall={onClickInstall} />
    );
  }

  // Otherwise, we are on the Developer Settings page and we want to show the action buttons
  return (
    <Access access={['org:admin']}>
      {({hasAccess}) => {
        let disablePublishReason = '';
        let disableDeleteReason = '';

        // Publish & Delete buttons will always be disabled if the app is published
        if (app.status === 'published') {
          disablePublishReason = t('Published integrations cannot be re-published.');
          disableDeleteReason = t('Published integrations cannot be removed.');
        } else if (!hasAccess) {
          disablePublishReason = t(
            'Organization owner permissions are required for this action.'
          );
          disableDeleteReason = t(
            'Organization owner permissions are required for this action.'
          );
        }

        return (
          <ActionButtons
            org={organization}
            app={app}
            // we only want to show the dashboard link on developer settings page
            showDashboard={!isOnIntegrationPage}
            showPublish={!isInternal}
            showDelete
            onPublish={onClickPublish}
            onDelete={onClickRemove}
            disablePublishReason={disablePublishReason}
            disableDeleteReason={disableDeleteReason}
          />
        );
      }}
    </Access>
  );
};

type UninstallButtonProps = {
  install: SentryAppInstallation;
  app: SentryApp;
  onClickUninstall?: (install: SentryAppInstallation) => void;
};
const UninstallButton = ({install, app, onClickUninstall}: UninstallButtonProps) => {
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
const InstallButton = ({onClickInstall}: InstallButtonProps) => {
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

type ActionButtonsProps = {
  org: Organization;
  app: SentryApp;

  showDashboard: boolean;
  showPublish: boolean;
  showDelete: boolean;
  onPublish?: () => void;
  onDelete?: (app: SentryApp) => void;
  // If you want to disable the publish or delete buttons, pass in a reason to display to the user in a tooltip
  disablePublishReason?: string;
  disableDeleteReason?: string;
};

const ActionButtons = ({
  org,
  app,
  showDashboard,
  showPublish,
  showDelete,
  onPublish,
  onDelete,
  disablePublishReason,
  disableDeleteReason,
}: ActionButtonsProps) => {
  const appDashboardButton = showDashboard ? (
    <StyledButton
      size="small"
      icon="icon-stats"
      to={`/settings/${org.slug}/developer-settings/${app.slug}/dashboard/`}
    >
      {t('Dashboard')}
    </StyledButton>
  ) : null;

  const publishRequestButton = showPublish ? (
    <StyledButton
      disabled={!!disablePublishReason}
      title={disablePublishReason}
      icon="icon-upgrade"
      size="small"
      onClick={onPublish}
    >
      {t('Publish')}
    </StyledButton>
  ) : null;

  const deleteConfirmMessage = t(
    `Deleting ${app.slug} will also delete any and all of its installations. \
       This is a permanent action. Do you wish to continue?`
  );
  const deleteButton = showDelete ? (
    disableDeleteReason ? (
      <StyledButton
        disabled
        title={disableDeleteReason}
        size="small"
        icon="icon-trash"
        label="Delete"
      />
    ) : (
      <ConfirmDelete
        message={deleteConfirmMessage}
        confirmInput={app.slug}
        priority="danger"
        onConfirm={() => onDelete && onDelete(app)}
      >
        <StyledButton size="small" icon="icon-trash" label="Delete" />
      </ConfirmDelete>
    )
  ) : null;

  return (
    <ButtonHolder>
      {appDashboardButton}
      {publishRequestButton}
      {deleteButton}
    </ButtonHolder>
  );
};

const StyledButton = styled(Button)`
  color: ${p => p.theme.gray2};
`;

const ButtonHolder = styled('div')`
  flex-direction: row;
  display: flex;
  & > * {
    margin-left: ${space(0.5)};
  }
`;

export default SentryApplicationRowButtons;
