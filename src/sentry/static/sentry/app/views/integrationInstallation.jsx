import React from 'react';
import styled from 'react-emotion';

import {singleLineRenderer} from 'app/utils/marked';
import {t, tct} from 'app/locale';
import AddIntegration from 'app/views/organizationIntegrations/addIntegration';
import Alert from 'app/components/alert';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import HookStore from 'app/stores/hookStore';
import NarrowLayout from 'app/components/narrowLayout';
import SelectControl from 'app/components/forms/selectControl';
import IndicatorStore from 'app/stores/indicatorStore';

export default class IntegrationInstallation extends AsyncView {
  state = {
    selectedOrg: null,
    organization: null,
    providers: [],
    reloading: false,
  };

  getEndpoints() {
    return [['organizations', '/organizations/']];
  }

  getTitle() {
    return t('Choose Installation Organization');
  }

  get provider() {
    return this.state.providers.find(p => p.key === this.props.params.providerId);
  }

  onInstall = data => {
    const orgId = this.state.organization.slug;
    this.props.router.push(
      `/settings/${orgId}/integrations/${data.provider.key}/${data.id}`
    );
  };

  onSelectOrg = ({value: orgId}) => {
    this.setState({selectedOrg: orgId, reloading: true});
    const reloading = false;

    this.api.request(`/organizations/${orgId}/`, {
      success: organization => this.setState({organization, reloading}),
      error: () => {
        this.setState({reloading});
        IndicatorStore.addError(t('Failed to retrieve organization details'));
      },
    });

    this.api.request(`/organizations/${orgId}/config/integrations/`, {
      success: providers => this.setState({providers: providers.providers, reloading}),
      error: () => {
        this.setState({reloading});
        IndicatorStore.addError(t('Failed to retrieve integration provider details'));
      },
    });
  };

  hasAccess = org => org.access.includes('org:integrations');

  renderAddButton() {
    const {organization, reloading} = this.state;
    const {installationId} = this.props.params;

    const AddButton = p => (
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
            disabled={organization && !this.hasAccess(organization)}
            onClick={() => addIntegration({installation_id: installationId})}
          />
        )}
      </AddIntegration>
    );
  }

  renderBody() {
    const {organization, selectedOrg} = this.state;
    const choices = this.state.organizations.map(org => [org.slug, org.slug]);

    const featureListHooks = HookStore.get('integrations:feature-gates');
    featureListHooks.push(() => ({FeatureList: null}));

    const {FeatureList} = featureListHooks[0]();

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

        {selectedOrg &&
          organization &&
          !this.hasAccess(organization) && (
            <Alert type="error" icon="icon-circle-exclamation">
              <p>
                {tct(
                  `You do not have permission to install integrations in
                  [organization]. Ask your organization owner or manager to
                  visit this page to finish installing this integration.`,
                  {organization: <strong>{organization.slug}</strong>}
                )}
              </p>
              <InstallLink>{window.location.href}</InstallLink>
            </Alert>
          )}

        {this.provider &&
          organization &&
          this.hasAccess(organization) &&
          FeatureList && (
            <React.Fragment>
              <p>
                {tct(
                  'The following features will be availble for [organization] when installed.',
                  {organization: <strong>{organization.slug}</strong>}
                )}
              </p>
              <FeatureList
                organization={organization}
                features={this.provider.metadata.features}
                formatter={singleLineRenderer}
              />
            </React.Fragment>
          )}

        <SelectControl
          onChange={this.onSelectOrg}
          value={selectedOrg}
          placeholder={t('Select an organization')}
          options={choices.map(([value, label]) => ({value, label}))}
        />

        <div className="form-actions">{this.renderAddButton()}</div>
      </NarrowLayout>
    );
  }
}

const InstallLink = styled('pre')`
  margin-bottom: 0;
  background: #fbe3e1;
`;
