import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import {
  LightWeightOrganization,
  Organization,
  SentryApp,
  SentryAppInstallation,
} from 'app/types';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import {installSentryApp} from 'app/actionCreators/sentryAppInstallations';
import {t, tct} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncView from 'app/views/asyncView';
import Field from 'app/views/settings/components/forms/field';
import {IconFlag} from 'app/icons';
import NarrowLayout from 'app/components/narrowLayout';
import OrganizationAvatar from 'app/components/avatar/organizationAvatar';
import SelectControl from 'app/components/forms/selectControl';
import SentryAppDetailsModal from 'app/components/modals/sentryAppDetailsModal';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';

type Props = RouteComponentProps<{sentryAppSlug: string}, {}>;

type State = AsyncView['state'] & {
  selectedOrgSlug: string | null;
  organization: Organization | null;
  organizations: LightWeightOrganization[];
  reloading: boolean;
  sentryApp: SentryApp;
};

export default class SentryAppExternalInstallation extends AsyncView<Props, State> {
  getDefaultState() {
    const state = super.getDefaultState();
    return {
      ...state,
      selectedOrgSlug: null,
      organization: null,
      organizations: [],
      reloading: false,
    };
  }

  getEndpoints(): [string, string][] {
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

  get isSingleOrg() {
    return this.state.organizations.length === 1;
  }

  get isSentryAppInternal() {
    const {sentryApp} = this.state;
    return sentryApp && sentryApp.status === 'internal';
  }

  get isSentryAppUnavailableForOrg() {
    const {sentryApp, selectedOrgSlug} = this.state;
    //if the app is unpublished for a different org
    return (
      selectedOrgSlug &&
      sentryApp?.owner?.slug !== selectedOrgSlug &&
      sentryApp.status === 'unpublished'
    );
  }

  get disableInstall() {
    const {reloading, isInstalled} = this.state;
    return isInstalled || reloading || this.isSentryAppUnavailableForOrg;
  }

  hasAccess = (org: LightWeightOrganization) => org.access.includes('org:integrations');

  onClose = () => {
    //if we came from somewhere, go back there. Otherwise, back to the integrations page
    const {selectedOrgSlug} = this.state;
    const newUrl = document.referrer || `/settings/${selectedOrgSlug}/integrations/`;
    window.location.assign(newUrl);
  };

  onInstall = async (): Promise<any | undefined> => {
    const {organization, sentryApp} = this.state;
    if (!organization || !sentryApp) {
      return undefined;
    }
    trackIntegrationEvent(
      {
        eventKey: 'integrations.installation_start',
        eventName: 'Integrations: Installation Start',
        integration_type: 'sentry_app',
        integration: sentryApp.slug,
        view: 'external_install',
        integration_status: sentryApp.status,
      },
      organization
    );

    const install = await installSentryApp(this.api, organization.slug, sentryApp);
    //installation is complete if the status is installed
    if (install.status === 'installed') {
      trackIntegrationEvent(
        {
          eventKey: 'integrations.installation_complete',
          eventName: 'Integrations: Installation Complete',
          integration_type: 'sentry_app',
          integration: sentryApp.slug,
          view: 'external_install',
          integration_status: sentryApp.status,
        },
        organization
      );
    }

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

  onSelectOrg = async (orgSlug: string) => {
    this.setState({selectedOrgSlug: orgSlug, reloading: true});

    try {
      const [organization, installations]: [
        Organization,
        SentryAppInstallation[]
      ] = await Promise.all([
        this.api.requestPromise(`/organizations/${orgSlug}/`),
        this.api.requestPromise(`/organizations/${orgSlug}/sentry-app-installations/`),
      ]);
      const isInstalled = installations
        .map(install => install.app.slug)
        .includes(this.sentryAppSlug);
      //all state fields should be set at the same time so analytics in SentryAppDetailsModal works properly
      this.setState({organization, isInstalled, reloading: false});
    } catch (err) {
      addErrorMessage(t('Failed to retrieve organization or integration details'));
      this.setState({reloading: false});
    }
  };

  onRequestSuccess = ({stateKey, data}) => {
    //if only one org, we can immediately update our selected org
    if (stateKey === 'organizations' && data.length === 1) {
      this.onSelectOrg(data[0].slug);
    }
  };

  getOptions() {
    return this.state.organizations.map(org => [
      org.slug,
      <div key={org.slug}>
        <OrganizationAvatar organization={org} />
        <OrgNameHolder>{org.slug}</OrgNameHolder>
      </div>,
    ]);
  }

  renderInternalAppError() {
    const {sentryApp} = this.state;
    return (
      <Alert type="error" icon={<IconFlag size="md" />}>
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
    const {organization, selectedOrgSlug, isInstalled, sentryApp} = this.state;
    if (selectedOrgSlug && organization && !this.hasAccess(organization)) {
      return (
        <Alert type="error" icon={<IconFlag size="md" />}>
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
    if (isInstalled && organization) {
      return (
        <Alert type="error" icon={<IconFlag size="md" />}>
          {tct('Integration [sentryAppName] already installed for [organization]', {
            organization: <strong>{organization.name}</strong>,
            sentryAppName: <strong>{sentryApp.name}</strong>,
          })}
        </Alert>
      );
    }

    if (this.isSentryAppUnavailableForOrg) {
      // use the slug of the owner if we have it, otherwise use 'another organization'
      const ownerSlug = sentryApp?.owner?.slug ?? 'another organization';
      return (
        <Alert type="error" icon={<IconFlag size="md" />}>
          {tct(
            'Integration [sentryAppName] is an unpublished integration for [otherOrg]. An unpublished integration can only be installed on the organization which created it.',
            {
              sentryAppName: <strong>{sentryApp.name}</strong>,
              otherOrg: <strong>{ownerSlug}</strong>,
            }
          )}
        </Alert>
      );
    }

    return null;
  }

  renderMultiOrgView() {
    const {selectedOrgSlug, sentryApp} = this.state;
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
        <Field label={t('Organization')} inline={false} stacked required>
          {() => (
            <SelectControl
              deprecatedSelectControl
              onChange={({value}) => this.onSelectOrg(value)}
              value={selectedOrgSlug}
              placeholder={t('Select an organization')}
              choices={this.getOptions()}
            />
          )}
        </Field>
      </div>
    );
  }

  renderSingleOrgView() {
    const {organizations, sentryApp} = this.state;
    //pull the name out of organizations since state.organization won't be loaded initially
    const organizationName = organizations[0].name;
    return (
      <div>
        <p>
          {tct('You are installing [sentryAppName] for organization [organization]', {
            organization: <strong>{organizationName}</strong>,
            sentryAppName: <strong>{sentryApp.name}</strong>,
          })}
        </p>
      </div>
    );
  }

  renderMainContent() {
    const {organization, sentryApp} = this.state;
    return (
      <div>
        <OrgViewHolder>
          {this.isSingleOrg ? this.renderSingleOrgView() : this.renderMultiOrgView()}
        </OrgViewHolder>
        {this.checkAndRenderError()}
        {organization && (
          <SentryAppDetailsModal
            sentryApp={sentryApp}
            organization={organization}
            onInstall={this.onInstall}
            closeModal={this.onClose}
            isInstalled={this.disableInstall}
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

const OrgNameHolder = styled('span')`
  margin-left: 5px;
`;

const Content = styled('div')`
  margin-bottom: 40px;
`;

const OrgViewHolder = styled('div')`
  margin-bottom: 20px;
`;
