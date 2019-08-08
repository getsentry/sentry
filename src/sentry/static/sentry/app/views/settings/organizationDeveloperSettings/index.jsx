import React from 'react';

import AlertLink from 'app/components/alertLink';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {removeSentryApp, publishRequestSentryApp} from 'app/actionCreators/sentryApps';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import SentryApplicationRow from 'app/views/settings/organizationDeveloperSettings/sentryApplicationRow';
import withOrganization from 'app/utils/withOrganization';
import {t} from 'app/locale';

class OrganizationDeveloperSettings extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  getEndpoints() {
    const {orgId} = this.props.params;

    return [['applications', `/organizations/${orgId}/sentry-apps/`]];
  }

  removeApp = app => {
    const apps = this.state.applications.filter(a => a.slug !== app.slug);
    removeSentryApp(this.api, app).then(
      () => {
        this.setState({applications: apps});
      },
      () => {}
    );
  };

  publishRequest = app => {
    // TODO(scefali) May want to do some state change after the request to show that the publish request has been made
    publishRequestSentryApp(this.api, app);
  };

  renderApplicationRow = app => {
    const {organization} = this.props;
    return (
      <SentryApplicationRow
        key={app.uuid}
        app={app}
        organization={organization}
        onRemoveApp={this.removeApp}
        onPublishRequest={this.publishRequest}
        showInstallationStatus={false}
      />
    );
  };

  renderInternalIntegrations() {
    const {orgId} = this.props.params;
    const integrations = this.state.applications.filter(app => app.status === 'internal');
    const isEmpty = integrations.length === 0;

    const action = (
      <Button
        priority="primary"
        size="small"
        to={`/settings/${orgId}/developer-settings/new-internal/`}
        icon="icon-circle-add"
      >
        {t('New Internal Integration')}
      </Button>
    );

    return (
      <Panel>
        <PanelHeader hasButtons={true}>
          {t('Internal Integrations')}
          {action}
        </PanelHeader>
        <PanelBody>
          {!isEmpty ? (
            integrations.map(this.renderApplicationRow)
          ) : (
            <EmptyMessage>
              {t('No internal integrations have been created yet.')}
            </EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    );
  }

  renderExernalIntegrations() {
    const {orgId} = this.props.params;
    const integrations = this.state.applications.filter(app => app.status !== 'internal');
    const isEmpty = integrations.length === 0;

    const action = (
      <Button
        priority="primary"
        size="small"
        to={`/settings/${orgId}/developer-settings/new-public/`}
        icon="icon-circle-add"
      >
        {t('New Public Integration')}
      </Button>
    );

    return (
      <Panel>
        <PanelHeader hasButtons={true}>
          {t('Public Integrations')}
          {action}
        </PanelHeader>
        <PanelBody>
          {!isEmpty ? (
            integrations.map(this.renderApplicationRow)
          ) : (
            <EmptyMessage>
              {t('No public integrations have been created yet.')}
            </EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    );
  }

  renderBody() {
    const {organization} = this.props;

    if (!organization.features.includes('sentry-apps')) {
      return (
        <div>
          <SettingsPageHeader title={t('Developer Settings')} />
          <Panel>
            <PanelBody>
              <EmptyMessage>
                {t(
                  "Want to build on top of the Sentry Integration Platform? We're working closely with early adopters. Please reach out to us by contacting partners@sentry.io"
                )}
              </EmptyMessage>
            </PanelBody>
          </Panel>
        </div>
      );
    }

    return (
      <div>
        <SettingsPageHeader title={t('Developer Settings')} />
        <AlertLink to="https://docs.sentry.io/workflow/integrations/integration-platform/">
          {t(
            'Have questions about the Integration Platform? Learn more about it in our docs.'
          )}
        </AlertLink>
        {this.renderExernalIntegrations()}
        {this.renderInternalIntegrations()}
      </div>
    );
  }
}

export default withOrganization(OrganizationDeveloperSettings);
