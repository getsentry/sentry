import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import {mutationOptions, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {FieldGroup} from '@sentry/scraps/form';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {BackendJsonAutoSaveForm} from 'sentry/components/backendJsonFormAdapter/backendJsonAutoSaveForm';
import type {FieldValue} from 'sentry/components/backendJsonFormAdapter/types';
import {List} from 'sentry/components/list';
import {ListItem} from 'sentry/components/list/listItem';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  IntegrationProvider,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useRouteAnalyticsEventNames} from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {unreachable} from 'sentry/utils/unreachable';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {IntegrationAlertRules} from './integrationAlertRules';
import {IntegrationCodeMappings} from './integrationCodeMappings';
import {IntegrationExternalTeamMappings} from './integrationExternalTeamMappings';
import {IntegrationExternalUserMappings} from './integrationExternalUserMappings';
import {IntegrationItem} from './integrationItem';
import {IntegrationServerlessFunctions} from './integrationServerlessFunctions';

type Tab = 'settings' | 'codeMappings' | 'userMappings' | 'teamMappings';

const makeIntegrationQuery = (
  organization: Organization,
  integrationId: string
): ApiQueryKey => {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/integrations/$integrationId/', {
      path: {organizationIdOrSlug: organization.slug, integrationId},
    }),
  ];
};

function ConfigureIntegration() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organization = useOrganization();
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
  }>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/config/integrations/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {staleTime: 0}
  );
  const {
    data: integration,
    isPending: isLoadingIntegration,
    isError: isErrorIntegration,
    refetch: refetchIntegration,
  } = useApiQuery<OrganizationIntegration>(
    makeIntegrationQuery(organization, integrationId),
    {staleTime: 0}
  );

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

  if (isLoadingConfig || isLoadingIntegration) {
    return <LoadingIndicator />;
  }

  if (isErrorConfig || isErrorIntegration) {
    return <LoadingError />;
  }

  if (!provider || !integration) {
    return null;
  }

  // The Settings tab only has content when there is something to render in
  // renderMainTab(). When empty, the tab is hidden entirely.
  const settingsInstructions =
    integration.dynamicDisplayInformation?.configure_integration?.instructions;
  const hasSettingsTabContent =
    integration.configOrganization.length > 0 ||
    (settingsInstructions?.length ?? 0) > 0 ||
    provider.features.includes('alert-rule') ||
    provider.features.includes('serverless');

  const hasStacktraceLinking = provider.features.includes('stacktrace-link');
  const hasCodeOwners =
    provider.features.includes('codeowners') &&
    organization.features.includes('integrations-codeowners');
  const hasUserMapping = provider.features.includes('user-mapping');

  // The Settings tab is paired with stacktrace linking or user mapping; it is
  // only shown when renderMainTab() would actually have content.
  const settingsTabs: Array<[Tab, string]> =
    hasSettingsTabContent && (hasStacktraceLinking || hasUserMapping)
      ? [['settings', t('Settings')]]
      : [];

  const stackTraceLinkingTabs: Array<[Tab, string]> = hasStacktraceLinking
    ? [['codeMappings', t('Code Mappings')]]
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
    ? [['userMappings', t('User Mappings')]]
    : [];

  const allTabs = [
    ...settingsTabs,
    ...stackTraceLinkingTabs,
    ...codeOwnerTabs,
    ...userMappingTabs,
  ];

  const tabParam = decodeScalar(location.query.tab) as Tab | undefined;
  const tab =
    tabParam && allTabs.some(([key]) => key === tabParam)
      ? tabParam
      : (allTabs[0]?.[0] ?? 'settings');

  const onTabChange = (value: Tab) => {
    // XXX: Omit the cursor to prevent paginating the next tab's queries.
    const {cursor: _, ...query} = location.query;
    navigate({
      query: {...query, tab: value},
    });
  };

  /**
   * Refetch everything, this could be improved to reload only the right thing
   */
  const onUpdateIntegration = () => {
    queryClient.removeQueries({
      queryKey: [`/organizations/${organization.slug}/config/integrations/`],
    });
    refetchConfig();

    queryClient.removeQueries({
      queryKey: makeIntegrationQuery(organization, integrationId),
    });
    refetchIntegration();
  };

  const getAction = () => {
    if (provider.key === 'pagerduty') {
      return (
        <PagerdutyAddServicesButton
          provider={provider}
          onInstall={onUpdateIntegration}
          organization={organization}
        />
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

    return null;
  };

  // TODO(Steve): Refactor components into separate tabs and use more generic tab logic
  function renderMainTab() {
    if (!provider || !integration) {
      return null;
    }

    const instructions =
      integration.dynamicDisplayInformation?.configure_integration?.instructions;

    const integrationEndpoint = getApiUrl(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
      {path: {organizationIdOrSlug: organization.slug, integrationId: integration.id}}
    );
    const integrationMutationOptions = mutationOptions({
      mutationFn: (data: Record<string, unknown>) =>
        fetchMutation({method: 'POST', url: integrationEndpoint, data}),
      onSuccess: () => {
        // it's important that we keep the mutation pending while the refetch is happening by returning it.
        // Otherwise, clicking toggles again while the invalidation is running won't do anything because they still see old defaultValues.
        // this makes the mutations seem to run longer than before. We could do optimistic updates here too, but I'm not sure it's worth the added complexity.
        return queryClient.invalidateQueries({
          queryKey: makeIntegrationQuery(organization, integrationId),
        });
      },
    });

    return (
      <Fragment>
        {integration.configOrganization.length > 0 && (
          <FieldGroup
            title={
              integration.provider.aspects.configure_integration?.title ||
              t('Organization Integration Settings')
            }
          >
            {integration.configOrganization.map(fieldConfig => (
              <BackendJsonAutoSaveForm
                key={fieldConfig.name}
                field={fieldConfig}
                initialValue={
                  integration.configData?.[fieldConfig.name] as FieldValue<
                    typeof fieldConfig
                  >
                }
                mutationOptions={integrationMutationOptions}
              />
            ))}
          </FieldGroup>
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
      case 'settings':
        return renderMainTab();
      case 'userMappings':
        return <IntegrationExternalUserMappings integration={integration} />;
      case 'teamMappings':
        return <IntegrationExternalTeamMappings integration={integration} />;
      default:
        unreachable(tab);
        return renderMainTab();
    }
  }

  function renderMainContent() {
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
      <SettingsPageHeader
        title={<IntegrationItem integration={integration} compact />}
        action={getAction()}
      />
      {renderMainContent()}
      <BreadcrumbTitle title={t('Configure %s', integration.provider.name)} />
    </Fragment>
  );
}

function PagerdutyAddServicesButton({
  provider,
  onInstall,
  organization,
}: {
  onInstall: () => void;
  organization: Organization;
  provider: IntegrationProvider;
}) {
  const {startFlow} = useAddIntegration();

  return (
    <Button
      variant="primary"
      size="sm"
      icon={<IconAdd />}
      onClick={() => startFlow({provider, onInstall, organization})}
    >
      {t('Add Services')}
    </Button>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};
`;

export default ConfigureIntegration;
