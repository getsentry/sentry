import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import {Organization, IntegrationProvider, Integration} from 'app/types';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import {
  trackIntegrationEvent,
  getIntegrationFeatureGate,
} from 'app/utils/integrationUtil';
import AddIntegration from 'app/views/organizationIntegrations/addIntegration';
import Alert from 'app/components/alert';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Field from 'app/views/settings/components/forms/field';
import {IconFlag} from 'app/icons';
import NarrowLayout from 'app/components/narrowLayout';
import SelectControl from 'app/components/forms/selectControl';

type Props = RouteComponentProps<{providerId: string; installationId: string}, {}>;

type State = AsyncView['state'] & {
  selectedOrg: string | null;
  organization: Organization | null;
  providers: IntegrationProvider[];
};

export default class IntegrationInstallation extends AsyncView<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      selectedOrg: null,
      organization: null,
      providers: [],
    };
  }

  getEndpoints(): [string, string][] {
    return [['organizations', '/organizations/']];
  }

  getTitle() {
    return t('Choose Installation Organization');
  }

  trackOpened() {
    const {organization} = this.state;
    const provider = this.provider;
    //should have these set but need to make TS happy
    if (!organization || !provider) {
      return;
    }

    //TODO: Probably don't need this event anymore
    trackIntegrationEvent(
      {
        eventKey: 'integrations.install_modal_opened',
        eventName: 'Integrations: Install Modal Opened',
        integration_type: 'first_party',
        integration: provider.key,
        //We actually don't know if it's installed but neither does the user in the view and multiple installs is possible
        already_installed: false,
        view: 'external_install',
      },
      organization,
      {startSession: true}
    );
  }

  get provider(): IntegrationProvider | undefined {
    return this.state.providers.find(p => p.key === this.props.params.providerId);
  }

  onInstall = (data: Integration) => {
    const {organization} = this.state;
    const orgId = organization && organization.slug;
    this.props.router.push(
      `/settings/${orgId}/integrations/${data.provider.key}/${data.id}`
    );
  };

  onSelectOrg = ({value: orgId}: {value: string}) => {
    this.setState({selectedOrg: orgId, reloading: true});
    const reloading = false;

    this.api.request(`/organizations/${orgId}/`, {
      success: (organization: Organization) =>
        this.setState({organization, reloading}, this.trackOpened),
      error: () => {
        this.setState({reloading});
        addErrorMessage(t('Failed to retrieve organization details'));
      },
    });

    this.api.request(`/organizations/${orgId}/config/integrations/`, {
      success: (providers: {providers: IntegrationProvider[]}) =>
        this.setState({providers: providers.providers, reloading}),
      error: () => {
        this.setState({reloading});
        addErrorMessage(t('Failed to retrieve integration provider details'));
      },
    });
  };

  hasAccess = (org: Organization) => org.access.includes('org:integrations');

  renderAddButton() {
    const {organization, reloading} = this.state;
    const {installationId} = this.props.params;

    const AddButton = (p: React.ComponentProps<typeof Button>) => (
      <Button priority="primary" busy={reloading} {...p}>
        Install Integration
      </Button>
    );

    if (!this.provider) {
      return <AddButton disabled />;
    }

    return (
      <AddIntegration provider={this.provider} onInstall={this.onInstall}>
        {addIntegration => (
          <AddButton
            disabled={!!organization && !this.hasAccess(organization)}
            onClick={() => addIntegration({installation_id: installationId})}
          />
        )}
      </AddIntegration>
    );
  }

  renderBody() {
    const {organization, selectedOrg} = this.state;
    const choices = this.state.organizations.map((org: Organization) => [
      org.slug,
      org.slug,
    ]);

    const {FeatureList} = getIntegrationFeatureGate();

    return (
      <NarrowLayout>
        <h3>{t('Finish integration installation')}</h3>
        <p>
          {tct(
            `Please pick a specific [organization:organization] to link with
            your integration installation.`,
            {
              organization: <strong />,
            }
          )}
        </p>

        {selectedOrg && organization && !this.hasAccess(organization) && (
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
        )}

        {this.provider && organization && this.hasAccess(organization) && FeatureList && (
          <React.Fragment>
            <p>
              {tct(
                'The following features will be available for [organization] when installed.',
                {organization: <strong>{organization.slug}</strong>}
              )}
            </p>
            <FeatureList
              organization={organization}
              features={this.provider.metadata.features}
              provider={this.provider}
            />
          </React.Fragment>
        )}

        <Field label={t('Organization')} inline={false} stacked required>
          {() => (
            <SelectControl
              deprecatedSelectControl
              onChange={this.onSelectOrg}
              value={selectedOrg}
              placeholder={t('Select an organization')}
              options={choices.map(([value, label]) => ({value, label}))}
            />
          )}
        </Field>

        <div className="form-actions">{this.renderAddButton()}</div>
      </NarrowLayout>
    );
  }
}

const InstallLink = styled('pre')`
  margin-bottom: 0;
  background: #fbe3e1;
`;
