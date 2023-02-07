import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import NavTabs from 'sentry/components/navTabs';
import {IconAdd, IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  IntegrationProvider,
  IntegrationWithConfig,
  Organization,
  PluginWithProjectList,
} from 'sentry/types';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {singleLineRenderer} from 'sentry/utils/marked';
import withApi from 'sentry/utils/withApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import BreadcrumbTitle from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import AddIntegration from './addIntegration';
import IntegrationAlertRules from './integrationAlertRules';
import IntegrationCodeMappings from './integrationCodeMappings';
import IntegrationExternalTeamMappings from './integrationExternalTeamMappings';
import IntegrationExternalUserMappings from './integrationExternalUserMappings';
import IntegrationItem from './integrationItem';
import IntegrationMainSettings from './integrationMainSettings';
import IntegrationRepos from './integrationRepos';
import IntegrationServerlessFunctions from './integrationServerlessFunctions';

type RouteParams = {
  integrationId: string;
  providerKey: string;
};
type Props = RouteComponentProps<RouteParams, {}> & {
  api: Client;
  organization: Organization;
};

type Tab = 'repos' | 'codeMappings' | 'userMappings' | 'teamMappings' | 'settings';

type State = AsyncView['state'] & {
  config: {providers: IntegrationProvider[]};
  integration: IntegrationWithConfig;
  plugins: PluginWithProjectList[] | null;
  tab?: Tab;
};

class ConfigureIntegration extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization} = this.props;
    const {integrationId} = this.props.params;

    return [
      ['config', `/organizations/${organization.slug}/config/integrations/`],
      [
        'integration',
        `/organizations/${organization.slug}/integrations/${integrationId}/`,
      ],
      ['plugins', `/organizations/${organization.slug}/plugins/configs/`],
    ];
  }

  componentDidMount() {
    const {
      location,
      router,
      organization,
      params: {providerKey},
    } = this.props;
    // This page should not be accessible by members (unless its github or gitlab)
    const allowMemberConfiguration = ['github', 'gitlab'].includes(providerKey);
    if (!allowMemberConfiguration && !organization.access.includes('org:integrations')) {
      router.push(
        normalizeUrl({
          pathname: `/settings/${organization.slug}/integrations/${providerKey}/`,
        })
      );
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

  handleJiraMigration = async () => {
    try {
      const {
        organization,
        params: {integrationId},
      } = this.props;

      await this.api.requestPromise(
        `/organizations/${organization.slug}/integrations/${integrationId}/issues/`,
        {
          method: 'PUT',
          data: {},
        }
      );
      this.setState(
        {
          plugins: (this.state.plugins || []).filter(({id}) => id === 'jira'),
        },
        () => addSuccessMessage(t('Migration in progress.'))
      );
    } catch (error) {
      addErrorMessage(t('Something went wrong! Please try again.'));
    }
  };
  getAction = (provider: IntegrationProvider | undefined) => {
    const {integration, plugins} = this.state;
    const shouldMigrateJiraPlugin =
      provider &&
      ['jira', 'jira_server'].includes(provider.key) &&
      (plugins || []).find(({id}) => id === 'jira');

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
              size="sm"
              icon={<IconAdd size="xs" isCircled />}
              onClick={() => onClick()}
            >
              {t('Add Services')}
            </Button>
          )}
        </AddIntegration>
      ) : shouldMigrateJiraPlugin ? (
        <Access access={['org:integrations']}>
          {({hasAccess}) => (
            <Confirm
              disabled={!hasAccess}
              header="Migrate Linked Issues from Jira Plugins"
              renderMessage={() => (
                <Fragment>
                  <p>
                    {t(
                      'This will automatically associate all the Linked Issues of your Jira Plugins to this integration.'
                    )}
                  </p>
                  <p>
                    {t(
                      'If the Jira Plugins had the option checked to automatically create a Jira ticket for every new Sentry issue checked, you will need to create alert rules to recreate this behavior. Jira Server does not have this feature.'
                    )}
                  </p>
                  <p>
                    {t(
                      'Once the migration is complete, your Jira Plugins will be disabled.'
                    )}
                  </p>
                </Fragment>
              )}
              onConfirm={() => {
                this.handleJiraMigration();
              }}
            >
              <Button priority="primary" size="md" disabled={!hasAccess}>
                {t('Migrate Plugin')}
              </Button>
            </Confirm>
          )}
        </Access>
      ) : null;

    return action;
  };

  // TODO(Steve): Refactor components into separate tabs and use more generic tab logic
  renderMainTab(provider: IntegrationProvider) {
    const {organization} = this.props;
    const {integration} = this.state;

    const instructions =
      integration.dynamicDisplayInformation?.configure_integration?.instructions;

    return (
      <Fragment>
        {integration.configOrganization.length > 0 && (
          <Form
            hideFooter
            saveOnBlur
            allowUndo
            apiMethod="POST"
            initialData={integration.configData || {}}
            apiEndpoint={`/organizations/${organization.slug}/integrations/${integration.id}/`}
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
        <BreadcrumbTitle
          routes={this.props.routes}
          title={t('Configure %s', integration.provider.name)}
        />
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

export default withOrganization(withApi(ConfigureIntegration));

const CapitalizedLink = styled('a')`
  text-transform: capitalize;
`;
