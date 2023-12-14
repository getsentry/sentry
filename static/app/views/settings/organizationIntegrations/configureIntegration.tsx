import {Fragment, useEffect} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NavTabs from 'sentry/components/navTabs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  IntegrationProvider,
  IntegrationWithConfig,
  Organization,
  PluginWithProjectList,
} from 'sentry/types';
import {singleLineRenderer} from 'sentry/utils/marked';
import {
  ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
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

type Props = RouteComponentProps<
  {
    integrationId: string;
    providerKey: string;
  },
  {}
>;

const TABS = [
  'repos',
  'codeMappings',
  'userMappings',
  'teamMappings',
  'settings',
] as const;
type Tab = (typeof TABS)[number];

const makeIntegrationQuery = (
  organization: Organization,
  integrationId: string
): ApiQueryKey => {
  return [`/organizations/${organization.slug}/integrations/${integrationId}/`];
};

const makePluginQuery = (organization: Organization): ApiQueryKey => {
  return [`/organizations/${organization.slug}/plugins/configs/`];
};

function ConfigureIntegration({params, router, routes, location}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const tab: Tab = TABS.includes(location.query.tab) ? location.query.tab : 'repos';
  const {integrationId, providerKey} = params;
  const {
    data: config = {providers: []},
    isLoading: isLoadingConfig,
    isError: isErrorConfig,
    refetch: refetchConfig,
    remove: removeConfig,
  } = useApiQuery<{
    providers: IntegrationProvider[];
  }>([`/organizations/${organization.slug}/config/integrations/`], {staleTime: 0});
  const {
    data: integration,
    isLoading: isLoadingIntegration,
    isError: isErrorIntegration,
    refetch: refetchIntegration,
    remove: removeIntegration,
  } = useApiQuery<IntegrationWithConfig>(
    makeIntegrationQuery(organization, integrationId),
    {staleTime: 0}
  );
  const {
    data: plugins,
    isLoading: isLoadingPlugins,
    isError: isErrorPlugins,
    refetch: refetchPlugins,
    remove: removePlugins,
  } = useApiQuery<PluginWithProjectList[] | null>(makePluginQuery(organization), {
    staleTime: 0,
  });

  const provider = config.providers.find(p => p.key === integration?.provider.key);

  useRouteAnalyticsEventNames(
    'integrations.details_viewed',
    'Integrations: Details Viewed'
  );
  useRouteAnalyticsParams(
    provider
      ? {
          integration: provider.key,
          integration_type: 'first_party',
        }
      : {}
  );

  useEffect(() => {
    // This page should not be accessible by members (unless its github or gitlab)
    const allowMemberConfiguration = ['github', 'gitlab'].includes(providerKey);
    if (!allowMemberConfiguration && !organization.access.includes('org:integrations')) {
      router.push(
        normalizeUrl({
          pathname: `/settings/${organization.slug}/integrations/${providerKey}/`,
        })
      );
    }
  }, [router, organization, providerKey]);

  if (isLoadingConfig || isLoadingIntegration || isLoadingPlugins) {
    return <LoadingIndicator />;
  }

  if (isErrorConfig || isErrorIntegration || isErrorPlugins) {
    return <LoadingError />;
  }

  if (!provider || !integration) {
    return null;
  }

  const onTabChange = (value: Tab) => {
    router.push({
      pathname: location.pathname,
      query: {...location.query, tab: value},
    });
  };

  /**
   * Refetch everything, this could be improved to reload only the right thing
   */
  const onUpdateIntegration = () => {
    removePlugins();
    refetchPlugins();

    removeConfig();
    refetchConfig();

    removeIntegration();
    refetchIntegration();
  };

  const handleOpsgenieMigration = async () => {
    try {
      await api.requestPromise(
        `/organizations/${organization.slug}/integrations/${integrationId}/migrate-opsgenie/`,
        {
          method: 'PUT',
        }
      );
      setApiQueryData<PluginWithProjectList[] | null>(
        queryClient,
        makePluginQuery(organization),
        oldData => {
          return oldData?.filter(({id}) => id === 'opsgenie') ?? [];
        }
      );
      addSuccessMessage(t('Migration in progress.'));
    } catch (error) {
      addErrorMessage(t('Something went wrong! Please try again.'));
    }
  };

  const handleJiraMigration = async () => {
    try {
      await api.requestPromise(
        `/organizations/${organization.slug}/integrations/${integrationId}/issues/`,
        {
          method: 'PUT',
          data: {},
        }
      );
      setApiQueryData<PluginWithProjectList[] | null>(
        queryClient,
        makePluginQuery(organization),
        oldData => {
          return oldData?.filter(({id}) => id === 'jira') ?? [];
        }
      );
      addSuccessMessage(t('Migration in progress.'));
    } catch (error) {
      addErrorMessage(t('Something went wrong! Please try again.'));
    }
  };

  const isInstalledOpsgeniePlugin = (plugin: PluginWithProjectList) => {
    return (
      plugin.id === 'opsgenie' &&
      plugin.projectList.length >= 1 &&
      plugin.projectList.find(({enabled}) => enabled === true)
    );
  };

  const getAction = () => {
    if (provider.key === 'pagerduty') {
      return (
        <AddIntegration
          provider={provider}
          onInstall={onUpdateIntegration}
          account={integration.domainName}
          organization={organization}
        >
          {onClick => (
            <Button
              priority="primary"
              size="sm"
              icon={<IconAdd isCircled />}
              onClick={() => onClick()}
            >
              {t('Add Services')}
            </Button>
          )}
        </AddIntegration>
      );
    }

    if (provider.key === 'discord') {
      return (
        <LinkButton
          aria-label="Open this server in the Discord app"
          size="sm"
          // @ts-ignore - the type of integration here is weird.
          href={`discord://discord.com/channels/${integration.externalId}`}
        >
          {t('Open in Discord')}
        </LinkButton>
      );
    }

    const shouldMigrateJiraPlugin =
      ['jira', 'jira_server'].includes(provider.key) &&
      (plugins || []).find(({id}) => id === 'jira');
    if (shouldMigrateJiraPlugin) {
      return (
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
                handleJiraMigration();
              }}
            >
              <Button priority="primary" disabled={!hasAccess}>
                {t('Migrate Plugin')}
              </Button>
            </Confirm>
          )}
        </Access>
      );
    }

    const shouldMigrateOpsgeniePlugin =
      provider.key === 'opsgenie' &&
      organization.features.includes('integrations-opsgenie-migration') &&
      (plugins || []).find(isInstalledOpsgeniePlugin);
    if (shouldMigrateOpsgeniePlugin) {
      return (
        <Access access={['org:integrations']}>
          {({hasAccess}) => (
            <Confirm
              disabled={!hasAccess}
              header="Migrate API Keys and Alert Rules from Opsgenie"
              renderMessage={() => (
                <Fragment>
                  <p>
                    {t(
                      'This will automatically associate all the API keys and Alert Rules of your Opsgenie Plugins to this integration.'
                    )}
                  </p>
                  <p>
                    {t(
                      'API keys will be automatically named after one of the projects with which they were associated.'
                    )}
                  </p>
                  <p>
                    {t(
                      'Once the migration is complete, your Opsgenie Plugins will be disabled.'
                    )}
                  </p>
                </Fragment>
              )}
              onConfirm={() => {
                handleOpsgenieMigration();
              }}
            >
              <Button priority="primary" disabled={!hasAccess}>
                {t('Migrate Plugin')}
              </Button>
            </Confirm>
          )}
        </Access>
      );
    }

    return null;
  };

  // TODO(Steve): Refactor components into separate tabs and use more generic tab logic
  function renderMainTab() {
    if (!provider || !integration) {
      return null;
    }

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
            {instructions.length === 1 ? (
              <span
                dangerouslySetInnerHTML={{__html: singleLineRenderer(instructions[0])}}
              />
            ) : (
              <List symbol={<IconArrow size="xs" direction="right" />}>
                {instructions.map((instruction, i) => (
                  <ListItem key={i}>
                    <span
                      dangerouslySetInnerHTML={{__html: singleLineRenderer(instruction)}}
                    />
                  </ListItem>
                )) ?? null}
              </List>
            )}
          </Alert>
        )}

        {provider.features.includes('alert-rule') && <IntegrationAlertRules />}

        {provider.features.includes('commits') && (
          <IntegrationRepos integration={integration} />
        )}

        {provider.features.includes('serverless') && (
          <IntegrationServerlessFunctions integration={integration} />
        )}
      </Fragment>
    );
  }

  function renderTabContent() {
    if (!integration) {
      return null;
    }
    switch (tab) {
      case 'codeMappings':
        return <IntegrationCodeMappings integration={integration} />;
      case 'repos':
        return renderMainTab();
      case 'userMappings':
        return <IntegrationExternalUserMappings integration={integration} />;
      case 'teamMappings':
        return <IntegrationExternalTeamMappings integration={integration} />;
      case 'settings':
        return (
          <IntegrationMainSettings
            onUpdate={onUpdateIntegration}
            organization={organization}
            integration={integration}
          />
        );
      default:
        return renderMainTab();
    }
  }

  // renders everything below header
  function renderMainContent() {
    const hasStacktraceLinking = provider!.features.includes('stacktrace-link');
    const hasCodeOwners =
      provider!.features.includes('codeowners') &&
      organization.features.includes('integrations-codeowners');
    // if no code mappings, render the single tab
    if (!hasStacktraceLinking) {
      return renderMainTab();
    }
    // otherwise render the tab view
    const tabs = [
      ['repos', t('Repositories')],
      ['codeMappings', t('Code Mappings')],
      ...(hasCodeOwners ? [['userMappings', t('User Mappings')]] : []),
      ...(hasCodeOwners ? [['teamMappings', t('Team Mappings')]] : []),
    ] as [id: Tab, label: string][];

    return (
      <Fragment>
        <NavTabs underlined>
          {tabs.map(tabTuple => (
            <li
              key={tabTuple[0]}
              className={tab === tabTuple[0] ? 'active' : ''}
              onClick={() => onTabChange(tabTuple[0])}
            >
              <CapitalizedLink>{tabTuple[1]}</CapitalizedLink>
            </li>
          ))}
        </NavTabs>
        {renderTabContent()}
      </Fragment>
    );
  }

  return (
    <Fragment>
      <SentryDocumentTitle
        title={integration ? integration.provider.name : 'Configure Integration'}
      />
      <BackButtonWrapper>
        <LinkButton
          icon={<IconArrow direction="left" size="sm" />}
          size="sm"
          to={`/settings/${organization.slug}/integrations/${provider.key}/`}
        >
          {t('Back')}
        </LinkButton>
      </BackButtonWrapper>
      <SettingsPageHeader
        noTitleStyles
        title={<IntegrationItem integration={integration} />}
        action={getAction()}
      />
      {renderMainContent()}
      <BreadcrumbTitle
        routes={routes}
        title={t('Configure %s', integration.provider.name)}
      />
    </Fragment>
  );
}

export default ConfigureIntegration;

const BackButtonWrapper = styled('div')`
  margin-bottom: ${space(2)};
  width: 100%;
`;

const CapitalizedLink = styled('a')`
  text-transform: capitalize;
`;
