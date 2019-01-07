import React from 'react';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {removeSentryApp} from 'app/actionCreators/sentryApps';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import SentryApplicationRow from 'app/views/settings/organizationDeveloperSettings/sentryApplicationRow';
import {t} from 'app/locale';

export default class OrganizationDeveloperSettings extends AsyncView {
  getEndpoints() {
    let {orgId} = this.props.params;

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
    let {orgId} = this.props.params;
    let action = (
      <Button
        priority="primary"
        size="small"
        to={`/settings/${orgId}/developer-settings/new/`}
        icon="icon-circle-add"
      >
        {t('Create New Application')}
      </Button>
    );

    let isEmpty = this.state.applications.length === 0;

    return (
      <div>
        <SettingsPageHeader title={t('Developer Settings')} action={action} />
        <Panel>
          <PanelHeader>{t('Applications')}</PanelHeader>
          <PanelBody>
            {!isEmpty ? (
              this.state.applications.map(app => {
                return (
                  <SentryApplicationRow
                    key={app.uuid}
                    app={app}
                    orgId={orgId}
                    onRemoveApp={this.removeApp}
                    showPublishStatus={true}
                  />
                );
              })
            ) : (
              <EmptyMessage>{t('No applications have been created yet.')}</EmptyMessage>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}
