import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import Confirm from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  IntegrationProvider,
  OrganizationIntegration,
  PluginWithProjectList,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {useRoutes} from 'sentry/utils/useRoutes';
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
import {IntegrationServerlessFunctions} from './integrationServerlessFunctions';

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

function ConfigureIntegration() {
  const routes = useRoutes();
  const location = useLocation();
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const tabParam = decodeScalar(location.query.tab) as Tab | undefined;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'repos';
  const {integrationId, providerKey} = useParams<{
    integrationId: string;
    providerKey: string;
  }>();
  const {
    data: config = {providers: []},
    isPending: isLoadingConfig,
    isError: isErrorConfig,
    refetch: refetchConfig,
  } = useApiQuery<{
    providers: IntegrationProvider[];
  }>([`/organizations/${organization.slug}/config/integrations/`], {staleTime: 0});
  const {
    data: integration,
    isPending: isLoadingIntegration,
    isError: isErrorIntegration,
    refetch: refetchIntegration,
  } = useApiQuery<OrganizationIntegration>(
    makeIntegrationQuery(organization, integrationId),
    {staleTime: 0}
  );
  const {
    data: plugins,
    isPending: isLoadingPlugins,
    isError: isErrorPlugins,
    refetch: refetchPlugins,
  } = useApiQuery<PluginWithProjectList[] | null>(makePluginQuery(organization), {
    staleTime: 0,
  });

  const provider = config.providers.find(p => p.key === integration?.provider.key);
  const {projects} = useProjects();

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
    refetchIntegration();
  }, [projects, refetchIntegration]);

  useEffect(() => {
    // This page should not be accessible by members (unless its github or gitlab)
    const allowMemberConfiguration = ['github', 'gitlab'].includes(providerKey);
    if (
      !allowMemberConfiguration &&
      !organization.access.includes('org:integrations') &&
      !isActiveSuperuser()
    ) {
      navigate(
        normalizeUrl({
          pathname: `/settings/${organization.slug}/integrations/${providerKey}/`,
        })
      );
    }
  }, [navigate, organization, providerKey]);

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
    // XXX: Omit the cursor to prevent paginating the next tab's queries.
    const {cursor: _, ...query} = location.query;
    navigate({
      pathname: location.pathname,
      query: {...query, tab: value},
    });
  };

  /**
   * Refetch everything, this could be improved to reload only the right thing
   */
  const onUpdateIntegration = () => {
    queryClient.removeQueries({queryKey: makePluginQuery(organization)});
    refetchPlugins();

    queryClient.removeQueries({
      queryKey: [`/organizations/${organization.slug}/config/integrations/`],
    });
    refetchConfig();

    queryClient.removeQueries({
      queryKey: makeIntegrationQuery(organization, integrationId),
    });
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

  const isOpsgeniePluginInstalled = () => {
    return (plugins || []).some(
      p =>
        p.id === 'opsgenie' &&
        p.projectList.length >= 1 &&
        p.projectList.some(({enabled}) => enabled === true)
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
              icon={<IconAdd />}
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
          aria-label={t('Open this server in the Discord app')}
          size="sm"
          href={`https://discord.com/channels/${integration.externalId}`}
        >
          {t('Open in Discord')}
        </LinkButton>
      );
    }

    const canMigrateJiraPlugin =
      ['jira', 'jira_server'].includes(provider.key) &&
      (plugins || []).find(({id}) => id === 'jira');
    if (canMigrateJiraPlugin) {
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

    const canMigrateOpsgeniePlugin =
      provider.key === 'opsgenie' && isOpsgeniePluginInstalled();
    if (canMigrateOpsgeniePlugin) {
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
          <Alert.Container>
            <Alert variant="info" showIcon={false}>
              {instructions.length === 1 ? (
                <span
                  dangerouslySetInnerHTML={{__html: singleLineRenderer(instructions[0]!)}}
                />
              ) : (
                <List symbol={<IconArrow size="xs" direction="right" />}>
                  {instructions.map((instruction, i) => (
                    <ListItem key={i}>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: singleLineRenderer(instruction),
                        }}
                      />
                    </ListItem>
                  )) ?? null}
                </List>
              )}
            </Alert>
          </Alert.Container>
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

  function renderMainContent() {
    const hasStacktraceLinking = provider!.features.includes('stacktrace-link');
    const hasCodeOwners =
      provider!.features.includes('codeowners') &&
      organization.features.includes('integrations-codeowners');
    const hasUserMapping = provider!.features.includes('user-mapping');

    const tabs: Array<[Tab, string]> = [];
    const stackTraceLinkingTabs: Array<[Tab, string]> = hasStacktraceLinking
      ? [
          ['repos', t('Repositories')],
          ['codeMappings', t('Code Mappings')],
        ]
      : [];

    const codeOwnerTabs: Array<[Tab, string]> = hasCodeOwners
      ? [
          ['userMappings', t('User Mappings')],
          ['teamMappings', t('Team Mappings')],
        ]
      : [];

    // User mappings are mutually exclusive with stacktrace linking
    // and code owners, so only render the main settings tab and user mappings.
    const userMappingTabs: Array<[Tab, string]> = hasUserMapping
      ? [
          ['repos', t('Settings')],
          ['userMappings', t('User Mappings')],
        ]
      : [];

    const allTabs = tabs
      .concat(stackTraceLinkingTabs)
      .concat(codeOwnerTabs)
      .concat(userMappingTabs);

    if (allTabs.length === 0) {
      return renderMainTab();
    }

    return (
      <Fragment>
        <TabsContainer>
          <Tabs value={tab} onChange={onTabChange}>
            <TabList>
              {allTabs.map(tabTuple => (
                <TabList.Item key={tabTuple[0]}>{tabTuple[1]}</TabList.Item>
              ))}
            </TabList>
          </Tabs>
        </TabsContainer>
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

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

export default ConfigureIntegration;

const BackButtonWrapper = styled('div')`
  margin-bottom: ${space(2)};
  width: 100%;
`;
