import React from 'react';

import Access from 'app/components/acl/access';

import {t} from 'app/locale';
import {LightWeightOrganization, SentryApp, SentryAppInstallation} from 'app/types';
import ActionButtons from './actionButtons';
import {InstallButton, UninstallButton} from './installButtons';

type Props = {
  organization: LightWeightOrganization;
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

export default SentryApplicationRowButtons;
