import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import AddIntegration from 'app/views/organizationIntegrations/addIntegration';
import BreadcrumbTitle from 'app/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons';
import Form from 'app/views/settings/components/forms/form';
import IntegrationAlertRules from 'app/views/organizationIntegrations/integrationAlertRules';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import IntegrationRepos from 'app/views/organizationIntegrations/integrationRepos';
import IntegrationCodeMappings from 'app/views/organizationIntegrations/integrationCodeMappings';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withOrganization from 'app/utils/withOrganization';
import {Organization, IntegrationWithConfig, IntegrationProvider} from 'app/types';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';
import {singleLineRenderer} from 'app/utils/marked';
import Alert from 'app/components/alert';
import NavTabs from 'app/components/navTabs';

type RouteParams = {
  orgId: string;
  integrationId: string;
};
type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

type Tab = 'repos' | 'codeMappings';

type State = AsyncView['state'] & {
  config: {providers: IntegrationProvider[]};
  integration: IntegrationWithConfig;
  tab?: Tab;
};
class ConfigureIntegration extends AsyncView<Props, State> {
  getEndpoints(): [string, string][] {
    const {orgId, integrationId} = this.props.params;

    return [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['integration', `/organizations/${orgId}/integrations/${integrationId}/`],
    ];
  }

  onRequestSuccess({stateKey, data}) {
    if (stateKey !== 'integration') {
      return;
    }
    trackIntegrationEvent(
      {
        eventKey: 'integrations.details_viewed',
        eventName: 'Integrations: Details Viewed',
        integration: data.provider.key,
        integration_type: 'first_party',
      },
      this.props.organization
    );
  }

  getTitle() {
    return this.state.integration
      ? this.state.integration.provider.name
      : 'Configure Integration';
  }

  hasCodeMappings(provider: IntegrationProvider) {
    return !!provider.hasCodeMappings;
  }

  onTabChange = (value: Tab) => {
    this.setState({tab: value});
  };

  get tab() {
    return this.state.tab || 'repos';
  }

  onUpdateIntegration = () => {
    this.setState(this.getDefaultState(), this.fetchData);
  };

  getAction = (provider: IntegrationProvider | undefined) => {
    const {integration} = this.state;
    const action =
      provider && provider.key === 'pagerduty' ? (
        <AddIntegration
          provider={provider}
          onInstall={this.onUpdateIntegration}
          account={integration.domainName}
        >
          {onClick => (
            <Button
              priority="primary"
              size="small"
              icon={<IconAdd size="xs" isCircled />}
              onClick={() => onClick()}
            >
              {t('Add Services')}
            </Button>
          )}
        </AddIntegration>
      ) : null;

    return action;
  };

  //TODO(Steve): Refactor components into separate tabs and use more generic tab logic
  renderMainTab(provider: IntegrationProvider) {
    const {orgId} = this.props.params;
    const {integration} = this.state;

    return (
      <React.Fragment>
        <BreadcrumbTitle routes={this.props.routes} title={integration.provider.name} />

        {integration.configOrganization.length > 0 && (
          <Form
            hideFooter
            saveOnBlur
            allowUndo
            apiMethod="POST"
            initialData={integration.configData}
            apiEndpoint={`/organizations/${orgId}/integrations/${integration.id}/`}
          >
            <JsonForm
              fields={integration.configOrganization}
              title={
                integration.provider.aspects.configure_integration?.title ||
                t('Organization Integration Settings')
              }
            />
          </Form>
        )}

        {integration.dynamicDisplayInformation?.configure_integration?.instructions.map(
          instruction => (
            <Alert type="info">
              <span dangerouslySetInnerHTML={{__html: singleLineRenderer(instruction)}} />
            </Alert>
          )
        )}

        {provider && provider.features.includes('alert-rule') && (
          <IntegrationAlertRules integration={integration} />
        )}

        {provider && provider.features.includes('commits') && (
          <IntegrationRepos {...this.props} integration={integration} />
        )}
      </React.Fragment>
    );
  }

  renderBody() {
    const {integration} = this.state;
    const provider = this.state.config.providers.find(
      p => p.key === integration.provider.key
    );
    if (!provider) {
      return null;
    }

    const title = <IntegrationItem integration={integration} />;
    const header = (
      <SettingsPageHeader noTitleStyles title={title} action={this.getAction(provider)} />
    );

    return (
      <React.Fragment>
        {header}
        {this.renderMainContent(provider)}
      </React.Fragment>
    );
  }

  //renders everything below header
  renderMainContent(provider: IntegrationProvider) {
    const {integration} = this.state;
    //if no code mappings, render the single tab
    if (!this.hasCodeMappings(provider)) {
      return this.renderMainTab(provider);
    }
    //otherwise render the tab view
    const tabs = [
      ['repos', t('Repositories')],
      ['codeMappings', t('Code Mappings')],
    ] as const;
    return (
      <React.Fragment>
        <NavTabs underlined>
          {tabs.map(tabTuple => (
            <li
              key={tabTuple[0]}
              className={this.tab === tabTuple[0] ? 'active' : ''}
              onClick={() => this.onTabChange(tabTuple[0])}
            >
              <CapitalizedLink>{tabTuple[1]}</CapitalizedLink>
            </li>
          ))}
        </NavTabs>
        {this.tab === 'codeMappings' ? (
          <IntegrationCodeMappings integration={integration} />
        ) : (
          this.renderMainTab(provider)
        )}
      </React.Fragment>
    );
  }
}

export default withOrganization(ConfigureIntegration);

const CapitalizedLink = styled('a')`
  text-transform: capitalize;
`;
