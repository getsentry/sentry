import React from 'react';
import styled from 'react-emotion';

import {t, tct} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncView from 'app/views/asyncView';
import Field from 'app/views/settings/components/forms/field';
import IndicatorStore from 'app/stores/indicatorStore';
import NarrowLayout from 'app/components/narrowLayout';
import SelectControl from 'app/components/forms/selectControl';
import Avatar from 'app/components/avatar';
import SentryAppDetailsModal from 'app/components/modals/sentryAppDetailsModal';
import {installSentryApp} from 'app/actionCreators/sentryAppInstallations';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';

export default class SentryAppInstallation extends AsyncView {
  state = {
    selectedOrg: null,
    organization: null,
    reloading: false,
  };

  getEndpoints() {
    return [
      ['organizations', '/organizations/'],
      ['sentryApp', `/sentry-apps/${this.sentryAppSlug}/`],
    ];
  }

  getTitle() {
    return t('Choose Installation Organization');
  }

  get sentryAppSlug() {
    return this.props.params.sentryAppSlug;
  }

  get isSentryAppInternal() {
    const {sentryApp} = this.state;
    return sentryApp && sentryApp.status === 'internal';
  }

  get isSentryAppUnavailableForOrg() {
    const {sentryApp, selectedOrg} = this.state;
    //if the app is unpublished for a different org
    return (
      selectedOrg &&
      sentryApp.owner.slug !== selectedOrg &&
      sentryApp.status === 'unpublished'
    );
  }

  get disableInstall() {
    return this.state.isInstalled || this.isSentryAppUnavailableForOrg;
  }

  onClose = () => {
    //if we came from somewhere, go back there. Otherwise, back to the root
    const newUrl = document.referrer || '/';
    window.location.assign(newUrl);
  };

  onInstall = async () => {
    const {organization, sentryApp} = this.state;
    const install = await installSentryApp(this.api, organization.slug, sentryApp);
    if (sentryApp.redirectUrl) {
      const queryParams = {
        installationId: install.uuid,
        code: install.code,
        orgSlug: organization.slug,
      };
      const redirectUrl = addQueryParamsToExistingUrl(sentryApp.redirectUrl, queryParams);
      return window.location.assign(redirectUrl);
    }
    return this.onClose();
  };

  onSelectOrg = async ({value: orgId}) => {
    this.setState({selectedOrg: orgId, reloading: true});

    try {
      const [organization, installations] = await Promise.all([
        this.api.requestPromise(`/organizations/${orgId}/`),
        this.api.requestPromise(`/organizations/${orgId}/sentry-app-installations/`),
      ]);
      const isInstalled = installations
        .map(install => install.app.slug)
        .includes(this.sentryAppSlug);
      this.setState({organization, isInstalled});
    } catch (err) {
      IndicatorStore.addError(
        t('Failed to retrieve organization or integration details')
      );
    }
    this.setState({reloading: false});
  };

  getOptions() {
    return this.state.organizations.map(org => [
      org.slug,
      <ChoiceHolder key={org.slug}>
        <Avatar organization={org} />
        <OrgNameHolder>{org.slug}</OrgNameHolder>
      </ChoiceHolder>,
    ]);
  }

  renderInternalAppError() {
    const {sentryApp} = this.state;
    return (
      <Alert type="error" icon="icon-circle-exclamation">
        {tct(
          'Integration [sentryAppName] is an internal integration. Internal integrations are automatically installed',
          {
            sentryAppName: <strong>{sentryApp.name}</strong>,
          }
        )}
      </Alert>
    );
  }

  checkAndRenderError() {
    const {organization, selectedOrg, isInstalled, sentryApp} = this.state;
    if (selectedOrg && organization && !this.hasAccess(organization)) {
      return (
        <Alert type="error" icon="icon-circle-exclamation">
          <p>
            {tct(
              `You do not have permission to install integrations in
          [organization]. Ask an organization owner or manager to
          visit this page to finish installing this integration.`,
              {organization: <strong>{organization.slug}</strong>}
            )}
          </p>
          <InstallLink>{window.location.href}</InstallLink>
        </Alert>
      );
    }
    if (isInstalled) {
      return (
        <Alert type="error" icon="icon-circle-exclamation">
          {tct('Integration [sentryAppName] already installed for [organization]', {
            organization: <strong>{organization.name}</strong>,
            sentryAppName: <strong>{sentryApp.name}</strong>,
          })}
        </Alert>
      );
    }

    if (this.isSentryAppUnavailableForOrg) {
      return (
        <Alert type="error" icon="icon-circle-exclamation">
          {tct(
            'Integration [sentryAppName] is an unpublished integration for a different organization',
            {
              sentryAppName: <strong>{sentryApp.name}</strong>,
            }
          )}
        </Alert>
      );
    }

    return null;
  }

  hasAccess = org => org.access.includes('org:integrations');

  renderMainContent() {
    const {organization, selectedOrg, sentryApp} = this.state;
    return (
      <div>
        <p>
          {tct(
            'Please pick a specific [organization:organization] to install [sentryAppName]',
            {
              organization: <strong />,
              sentryAppName: <strong>{sentryApp.name}</strong>,
            }
          )}
        </p>
        {this.checkAndRenderError()}
        <Field label={t('Organization')} inline={false} stacked required>
          {() => (
            <SelectControl
              onChange={this.onSelectOrg}
              value={selectedOrg}
              placeholder={t('Select an organization')}
              choices={this.getOptions()}
            />
          )}
        </Field>
        {organization && (
          <SentryAppDetailsModal
            sentryApp={sentryApp}
            organization={organization}
            onInstall={this.onInstall}
            closeModal={this.onClose}
            isInstalled={this.disableInstall}
            closeOnInstall={false}
          />
        )}
      </div>
    );
  }

  renderBody() {
    return (
      <NarrowLayout>
        <Content>
          <h3>{t('Finish integration installation')}</h3>
          {this.isSentryAppInternal
            ? this.renderInternalAppError()
            : this.renderMainContent()}
        </Content>
      </NarrowLayout>
    );
  }
}

const InstallLink = styled('pre')`
  margin-bottom: 0;
  background: #fbe3e1;
`;

const ChoiceHolder = styled('div')``;

const OrgNameHolder = styled('span')`
  margin-left: 5px;
`;

const Content = styled('div')`
  margin-bottom: 40px;
`;
