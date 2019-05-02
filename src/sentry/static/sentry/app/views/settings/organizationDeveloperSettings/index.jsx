import React from 'react';

import AlertLink from 'app/components/alertLink';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {removeSentryApp} from 'app/actionCreators/sentryApps';
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

  renderBody() {
    const {organization} = this.props;
    const {orgId} = this.props.params;
    const action = (
      <Button
        priority="primary"
        size="small"
        to={`/settings/${orgId}/developer-settings/new/`}
        icon="icon-circle-add"
      >
        {t('Create New Integration')}
      </Button>
    );

    const isEmpty = this.state.applications.length === 0;
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
        <SettingsPageHeader title={t('Developer Settings')} action={action} />
        <AlertLink to="https://docs.sentry.io/workflow/integrations/integration-platform/">
          {t(
            'Have questions about the Integration Platform? Learn more about it in our docs.'
          )}
        </AlertLink>
        <Panel>
          <PanelHeader>{t('Integrations')}</PanelHeader>
          <PanelBody>
            {!isEmpty ? (
              this.state.applications.map(app => {
                return (
                  <SentryApplicationRow
                    key={app.uuid}
                    app={app}
                    organization={organization}
                    onRemoveApp={this.removeApp}
                    showPublishStatus={true}
                  />
                );
              })
            ) : (
              <EmptyMessage>{t('No integrations have been created yet.')}</EmptyMessage>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default withOrganization(OrganizationDeveloperSettings);
