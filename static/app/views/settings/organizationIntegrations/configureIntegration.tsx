import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import NavTabs from 'sentry/components/navTabs';
import {IconAdd, IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {IntegrationProvider, IntegrationWithConfig, Organization} from 'sentry/types';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {singleLineRenderer} from 'sentry/utils/marked';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import AddIntegration from 'sentry/views/organizationIntegrations/addIntegration';
import IntegrationAlertRules from 'sentry/views/organizationIntegrations/integrationAlertRules';
import IntegrationCodeMappings from 'sentry/views/organizationIntegrations/integrationCodeMappings';
import IntegrationExternalTeamMappings from 'sentry/views/organizationIntegrations/integrationExternalTeamMappings';
import IntegrationExternalUserMappings from 'sentry/views/organizationIntegrations/integrationExternalUserMappings';
import IntegrationItem from 'sentry/views/organizationIntegrations/integrationItem';
import IntegrationMainSettings from 'sentry/views/organizationIntegrations/integrationMainSettings';
import IntegrationRepos from 'sentry/views/organizationIntegrations/integrationRepos';
import IntegrationServerlessFunctions from 'sentry/views/organizationIntegrations/integrationServerlessFunctions';
import BreadcrumbTitle from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type RouteParams = {
  integrationId: string;
  orgId: string;
  providerKey: string;
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
    const {
      location,
      router,
      organization,
      params: {orgId, providerKey},
    } = this.props;
    // This page should not be accessible by members
    if (!organization.access.includes('org:integrations')) {
      router.push({
        pathname: `/settings/${orgId}/integrations/${providerKey}/`,
      });
    }
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
    trackIntegrationAnalytics('integrations.details_viewed', {
      integration: data.provider.key,
      integration_type: 'first_party',
      organization: this.props.organization,
    });
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
    ] as [id: Tab, label: string][];

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
              onClick={() => this.onTabChange(tabTuple[0])}
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
