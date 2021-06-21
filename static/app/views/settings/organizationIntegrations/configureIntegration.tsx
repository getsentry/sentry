import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import Button from 'app/components/button';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import NavTabs from 'app/components/navTabs';
import {IconAdd, IconArrow} from 'app/icons';
import {t} from 'app/locale';
import {IntegrationProvider, IntegrationWithConfig, Organization} from 'app/types';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';
import {singleLineRenderer} from 'app/utils/marked';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';
import AddIntegration from 'app/views/organizationIntegrations/addIntegration';
import IntegrationAlertRules from 'app/views/organizationIntegrations/integrationAlertRules';
import IntegrationCodeMappings from 'app/views/organizationIntegrations/integrationCodeMappings';
import IntegrationExternalTeamMappings from 'app/views/organizationIntegrations/integrationExternalTeamMappings';
import IntegrationExternalUserMappings from 'app/views/organizationIntegrations/integrationExternalUserMappings';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import IntegrationMainSettings from 'app/views/organizationIntegrations/integrationMainSettings';
import IntegrationRepos from 'app/views/organizationIntegrations/integrationRepos';
import IntegrationServerlessFunctions from 'app/views/organizationIntegrations/integrationServerlessFunctions';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import BreadcrumbTitle from 'app/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

type RouteParams = {
  orgId: string;
  integrationId: string;
};
type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

type Tab = 'repos' | 'codeMappings' | 'userMappings' | 'teamMappings' | 'settings';

type State = AsyncView['state'] & {
  config: {providers: IntegrationProvider[]};
  integration: IntegrationWithConfig;
  tab?: Tab;
};
class ConfigureIntegration extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId, integrationId} = this.props.params;

    return [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['integration', `/organizations/${orgId}/integrations/${integrationId}/`],
    ];
  }

  componentDidMount() {
    const {location} = this.props;
    const value =
      (['codeMappings', 'userMappings', 'teamMappings'] as const).find(
        tab => tab === location.query.tab
      ) || 'repos';

    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState({tab: value});
  }

  onRequestSuccess({stateKey, data}) {
    if (stateKey !== 'integration') {
      return;
    }
    trackIntegrationEvent(
      'integrations.details_viewed',
      {
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

  hasStacktraceLinking(provider: IntegrationProvider) {
    // CodeOwners will only work if the provider has StackTrace Linking
    return (
      provider.features.includes('stacktrace-link') &&
      this.props.organization.features.includes('integrations-stacktrace-link')
    );
  }

  hasCodeOwners() {
    return this.props.organization.features.includes('integrations-codeowners');
  }

  isCustomIntegration() {
    const {integration} = this.state;
    const {organization} = this.props;
    return (
      organization.features.includes('integrations-custom-scm') &&
      integration.provider.key === 'custom_scm'
    );
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
          organization={this.props.organization}
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

  // TODO(Steve): Refactor components into separate tabs and use more generic tab logic
  renderMainTab(provider: IntegrationProvider) {
    const {orgId} = this.props.params;
    const {integration} = this.state;

    const instructions =
      integration.dynamicDisplayInformation?.configure_integration?.instructions;

    return (
      <Fragment>
        <BreadcrumbTitle routes={this.props.routes} title={integration.provider.name} />

        {integration.configOrganization.length > 0 && (
          <Form
            hideFooter
            saveOnBlur
            allowUndo
            apiMethod="POST"
            initialData={integration.configData || {}}
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

        {instructions && instructions.length > 0 && (
          <Alert type="info">
            {instructions?.length === 1 ? (
              <span
                dangerouslySetInnerHTML={{__html: singleLineRenderer(instructions[0])}}
              />
            ) : (
              <List symbol={<IconArrow size="xs" direction="right" />}>
                {instructions?.map((instruction, i) => (
                  <ListItem key={i}>
                    <span
                      dangerouslySetInnerHTML={{__html: singleLineRenderer(instruction)}}
                    />
                  </ListItem>
                )) ?? []}
              </List>
            )}
          </Alert>
        )}

        {provider.features.includes('alert-rule') && <IntegrationAlertRules />}

        {provider.features.includes('commits') && (
          <IntegrationRepos {...this.props} integration={integration} />
        )}

        {provider.features.includes('serverless') && (
          <IntegrationServerlessFunctions integration={integration} />
        )}
      </Fragment>
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
      <Fragment>
        {header}
        {this.renderMainContent(provider)}
      </Fragment>
    );
  }

  // renders everything below header
  renderMainContent(provider: IntegrationProvider) {
    // if no code mappings, render the single tab
    if (!this.hasStacktraceLinking(provider)) {
      return this.renderMainTab(provider);
    }
    // otherwise render the tab view
    const tabs = [
      ['repos', t('Repositories')],
      ['codeMappings', t('Code Mappings')],
      ...(this.hasCodeOwners() ? [['userMappings', t('User Mappings')]] : []),
      ...(this.hasCodeOwners() ? [['teamMappings', t('Team Mappings')]] : []),
    ];

    if (this.isCustomIntegration()) {
      tabs.unshift(['settings', t('Settings')]);
    }

    return (
      <Fragment>
        <NavTabs underlined>
          {tabs.map(tabTuple => (
            <li
              key={tabTuple[0]}
              className={this.tab === tabTuple[0] ? 'active' : ''}
              onClick={() => this.onTabChange(tabTuple[0] as Tab)}
            >
              <CapitalizedLink>{tabTuple[1]}</CapitalizedLink>
            </li>
          ))}
        </NavTabs>
        {this.renderTabContent(this.tab, provider)}
      </Fragment>
    );
  }

  renderTabContent(tab: Tab, provider: IntegrationProvider) {
    const {integration} = this.state;
    const {organization} = this.props;
    switch (tab) {
      case 'codeMappings':
        return <IntegrationCodeMappings integration={integration} />;
      case 'repos':
        return this.renderMainTab(provider);
      case 'userMappings':
        return <IntegrationExternalUserMappings integration={integration} />;
      case 'teamMappings':
        return <IntegrationExternalTeamMappings integration={integration} />;
      case 'settings':
        return (
          <IntegrationMainSettings
            onUpdate={this.onUpdateIntegration}
            organization={organization}
            integration={integration}
          />
        );
      default:
        return this.renderMainTab(provider);
    }
  }
}

export default withOrganization(ConfigureIntegration);

const CapitalizedLink = styled('a')`
  text-transform: capitalize;
`;
