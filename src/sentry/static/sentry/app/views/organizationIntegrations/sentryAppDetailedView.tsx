import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import Button from 'app/components/button';
import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import {
  installSentryApp,
  uninstallSentryApp,
} from 'app/actionCreators/sentryAppInstallations';
import {toPermissions} from 'app/utils/consolidatedScopes';
import CircleIndicator from 'app/components/circleIndicator';
import {IntegrationFeature, SentryApp, SentryAppInstallation} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import SplitInstallationIdModal from 'app/views/organizationIntegrations/SplitInstallationIdModal';
import {openModal} from 'app/actionCreators/modal';
import {getSentryAppInstallStatus} from 'app/utils/integrationUtil';

import {UninstallAppButton} from '../settings/organizationDeveloperSettings/sentryApplicationRow/installButtons';
import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';

type State = {
  sentryApp: SentryApp;
  featureData: IntegrationFeature[];
  appInstalls: SentryAppInstallation[];
};

type Tab = AbstractIntegrationDetailedView['state']['tab'];

class SentryAppDetailedView extends AbstractIntegrationDetailedView<
  AbstractIntegrationDetailedView['props'],
  State & AbstractIntegrationDetailedView['state']
> {
  tabs: Tab[] = ['overview'];
  getEndpoints(): ([string, string, any] | [string, string])[] {
    const {
      organization,
      params: {integrationSlug},
    } = this.props;
    const baseEndpoints: ([string, string, any] | [string, string])[] = [
      ['sentryApp', `/sentry-apps/${integrationSlug}/`],
      ['featureData', `/sentry-apps/${integrationSlug}/features/`],
      ['appInstalls', `/organizations/${organization.slug}/sentry-app-installations/`],
    ];

    return baseEndpoints;
  }

  onLoadAllEndpointsSuccess() {
    const {
      organization,
      params: {integrationSlug},
      router,
    } = this.props;

    //redirect for internal integrations
    if (this.sentryApp.status === 'internal') {
      router.push(
        `/settings/${organization.slug}/developer-settings/${integrationSlug}/`
      );
      return;
    }

    super.onLoadAllEndpointsSuccess();
  }

  get integrationType() {
    return 'sentry_app' as const;
  }

  get sentryApp() {
    return this.state.sentryApp;
  }

  get description() {
    return this.state.sentryApp.overview || '';
  }

  get author() {
    return this.sentryApp.author;
  }

  get resourceLinks() {
    //sentry apps don't have resources (yet)
    return [];
  }

  get permissions() {
    return toPermissions(this.sentryApp.scopes);
  }

  get installationStatus() {
    return getSentryAppInstallStatus(this.install);
  }

  get integrationName() {
    return this.sentryApp.name;
  }

  get featureData() {
    return this.state.featureData;
  }

  get install() {
    return this.state.appInstalls.find(i => i.app.slug === this.sentryApp.slug);
  }

  redirectUser = (install: SentryAppInstallation) => {
    const {organization} = this.props;
    const {sentryApp} = this.state;
    const queryParams = {
      installationId: install.uuid,
      code: install.code,
      orgSlug: organization.slug,
    };
    if (sentryApp.redirectUrl) {
      const redirectUrl = addQueryParamsToExistingUrl(sentryApp.redirectUrl, queryParams);
      window.location.assign(redirectUrl);
    }
  };

  handleInstall = async () => {
    const {organization} = this.props;
    const {sentryApp} = this.state;
    this.trackIntegrationEvent({
      eventKey: 'integrations.installation_start',
      eventName: 'Integrations: Installation Start',
      integration_status: sentryApp.status,
    });
    // installSentryApp adds a message on failure
    const install = await installSentryApp(this.api, organization.slug, sentryApp);

    //installation is complete if the status is installed
    if (install.status === 'installed') {
      this.trackIntegrationEvent({
        eventKey: 'integrations.installation_complete',
        eventName: 'Integrations: Installation Complete',
        integration_status: sentryApp.status,
      });
    }

    if (!sentryApp.redirectUrl) {
      addSuccessMessage(t(`${sentryApp.slug} successfully installed.`));
      this.setState({appInstalls: [install, ...this.state.appInstalls]});

      //hack for split so we can show the install ID to users for them to copy
      //Will remove once the proper fix is in place
      if (['split', 'split-dev', 'split-testing'].includes(sentryApp.slug)) {
        openModal(({closeModal}) => (
          <SplitInstallationIdModal
            installationId={install.uuid}
            closeModal={closeModal}
          />
        ));
      }
    } else {
      this.redirectUser(install);
    }
  };

  handleUninstall = async (install: SentryAppInstallation) => {
    try {
      await uninstallSentryApp(this.api, install);
      this.trackIntegrationEvent({
        eventKey: 'integrations.uninstall_completed',
        eventName: 'Integrations: Uninstall Completed',
        integration_status: this.sentryApp.status,
      });
      const appInstalls = this.state.appInstalls.filter(
        i => i.app.slug !== this.sentryApp.slug
      );
      return this.setState({appInstalls});
    } catch (error) {
      return addErrorMessage(t(`Unable to uninstall ${this.sentryApp.name}`));
    }
  };

  recordUninstallClicked = () => {
    const sentryApp = this.sentryApp;
    this.trackIntegrationEvent({
      eventKey: 'integrations.uninstall_clicked',
      eventName: 'Integrations: Uninstall Clicked',
      integration_status: sentryApp.status,
    });
  };

  renderPermissions() {
    const permissions = this.permissions;
    if (!Object.keys(permissions).some(scope => permissions[scope].length > 0)) {
      return null;
    }

    return (
      <PermissionWrapper>
        <Title>Permissions</Title>
        {permissions.read.length > 0 && (
          <Permission>
            <Indicator />
            <Text key="read">
              {tct('[read] access to [resources] resources', {
                read: <strong>Read</strong>,
                resources: permissions.read.join(', '),
              })}
            </Text>
          </Permission>
        )}
        {permissions.write.length > 0 && (
          <Permission>
            <Indicator />
            <Text key="write">
              {tct('[read] and [write] access to [resources] resources', {
                read: <strong>Read</strong>,
                write: <strong>Write</strong>,
                resources: permissions.read.join(', '),
              })}
            </Text>
          </Permission>
        )}
        {permissions.admin.length > 0 && (
          <Permission>
            <Indicator />
            <Text key="admin">
              {tct('[admin] access to [resources] resources', {
                admin: <strong>Admin</strong>,
                resources: permissions.read.join(', '),
              })}
            </Text>
          </Permission>
        )}
      </PermissionWrapper>
    );
  }

  renderTopButton(disabledFromFeatures: boolean, userHasAccess: boolean) {
    return !this.install ? (
      <InstallButton
        size="small"
        priority="primary"
        disabled={disabledFromFeatures || !userHasAccess}
        onClick={() => this.handleInstall()}
        style={{marginLeft: space(1)}}
        data-test-id="install-button"
      >
        {t('Accept & Install')}
      </InstallButton>
    ) : (
      <UninstallAppButton
        install={this.install}
        app={this.sentryApp}
        onClickUninstall={this.handleUninstall}
        onUninstallModalOpen={this.recordUninstallClicked}
        disabled={!userHasAccess}
      />
    );
  }

  //no configuraitons for sentry apps
  renderConfigurations() {
    return null;
  }
}

const Text = styled('p')`
  margin: 0px 6px;
`;

const Permission = styled('div')`
  display: flex;
`;

const PermissionWrapper = styled('div')`
  padding-bottom: ${space(2)};
`;

const Title = styled('p')`
  margin-bottom: ${space(1)};
  font-weight: bold;
`;

const Indicator = styled(p => <CircleIndicator size={7} {...p} />)`
  margin-top: 7px;
  color: ${p => p.theme.success};
`;

const InstallButton = styled(Button)`
  margin-left: ${space(1)};
`;

export default withOrganization(SentryAppDetailedView);
