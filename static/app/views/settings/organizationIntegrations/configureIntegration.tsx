import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {mutationOptions, useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {FieldGroup} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';

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
  Integration,
  IntegrationProvider,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useRouteAnalyticsEventNames} from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {parseGcpProjectIds} from 'sentry/utils/seer/gcpConnection';
import {unreachable} from 'sentry/utils/unreachable';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import {Divider} from 'sentry/views/settings/components/settingsBreadcrumb/divider';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {IntegrationAlertRules} from './integrationAlertRules';
import {IntegrationCodeMappings} from './integrationCodeMappings';
import {IntegrationExternalTeamMappings} from './integrationExternalTeamMappings';
import {IntegrationExternalUserMappings} from './integrationExternalUserMappings';
import {IntegrationIcon} from './integrationIcon';
import {IntegrationServerlessFunctions} from './integrationServerlessFunctions';

type Tab = 'settings' | 'codeMappings' | 'userMappings' | 'teamMappings';

function organizationIntegrationApiOptions({
  organizationSlug,
  integrationId,
}: {
  integrationId: string;
  organizationSlug: string;
}) {
  return apiOptions.as<OrganizationIntegration>()(
    '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
    {
      path: {organizationIdOrSlug: organizationSlug, integrationId},
      staleTime: 0,
    }
  );
}

function organizationIntegrationsApiOptions({
  organizationSlug,
  providerKey,
}: {
  organizationSlug: string;
  providerKey: string;
}) {
  return apiOptions.as<Integration[]>()(
    '/organizations/$organizationIdOrSlug/integrations/',
    {
      path: {organizationIdOrSlug: organizationSlug},
      query: {provider_key: providerKey, includeConfig: 0},
      staleTime: 0,
    }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withJiraStatusMappingRemovals(
  data: Record<string, unknown>,
  previousMappings: unknown
): Record<string, unknown> {
  if (!Object.hasOwn(data, 'sync_status_forward')) {
    return data;
  }

  const submittedMappings = data.sync_status_forward;
  if (!isRecord(submittedMappings) || !isRecord(previousMappings)) {
    return data;
  }

  const removedMappings = Object.fromEntries(
    Object.keys(previousMappings)
      .filter(key => !Object.hasOwn(submittedMappings, key))
      .map(key => [key, null])
  );

  return {
    ...data,
    sync_status_forward: {
      ...submittedMappings,
      ...removedMappings,
    },
  };
}

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
    isPlaceholderData,
    refetch: refetchIntegration,
  } = useQuery({
    ...organizationIntegrationApiOptions({
      organizationSlug: organization.slug,
      integrationId,
    }),
    placeholderData: () => {
      const listData = queryClient.getQueryData(
        organizationIntegrationsApiOptions({
          organizationSlug: organization.slug,
          providerKey,
        }).queryKey
      );
      const cachedIntegration = listData?.json.find(item => item.id === integrationId);

      // The summary only supplies the breadcrumb while the full configuration loads.
      return cachedIntegration
        ? {
            json: {
              ...cachedIntegration,
              configData: null,
              configOrganization: [],
              organizationId: Number(organization.id),
              externalId: cachedIntegration.externalId ?? '',
            },
            headers: {},
          }
        : undefined;
    },
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

  if (isErrorConfig || isErrorIntegration) {
    return <LoadingError />;
  }

  if (isLoadingConfig || isLoadingIntegration || isPlaceholderData) {
    return (
      <Fragment>
        {integration && <IntegrationNavigationHeader integration={integration} />}
        <LoadingIndicator />
      </Fragment>
    );
  }

  if (!provider || !integration) {
    return null;
  }

  const usesExplicitMappingRemovals =
    provider.key === 'jira' &&
    organization.features.includes('jira-explicit-mapping-removals');

  // The Settings tab only has content when there is something to render in
  // renderMainTab(). When empty, the tab is hidden entirely.
  const settingsInstructions =
    integration.dynamicDisplayInformation?.configure_integration?.instructions;
  const hasSettingsTabContent =
    (integration.configOrganization?.length ?? 0) > 0 ||
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

    queryClient.removeQueries(
      organizationIntegrationApiOptions({
        organizationSlug: organization.slug,
        integrationId,
      })
    );
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

    const integrationQueryOptions = organizationIntegrationApiOptions({
      organizationSlug: organization.slug,
      integrationId,
    });

    const verifyGcpConnection = async () => {
      const savedConfig = queryClient.getQueryData(integrationQueryOptions.queryKey)?.json
        .configData;
      const customerSaEmail = savedConfig?.customer_sa_email;
      const projectIds = savedConfig?.projects;
      if (typeof customerSaEmail !== 'string' || typeof projectIds !== 'string') {
        return;
      }

      const gcpProjectIds = parseGcpProjectIds(projectIds);
      if (!customerSaEmail || !gcpProjectIds.length) {
        return;
      }

      await fetchMutation({
        method: 'POST',
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/monitoring-providers/gcp/verify-connection/',
          {path: {organizationIdOrSlug: organization.slug}}
        ),
        data: {customerSaEmail, gcpProjectIds},
      });
    };

    const integrationMutationOptions = mutationOptions({
      mutationFn: (data: Record<string, unknown>) => {
        let requestData = data;
        if (usesExplicitMappingRemovals) {
          requestData = withJiraStatusMappingRemovals(
            data,
            integration.configData?.sync_status_forward
          );
        }

        return fetchMutation({
          method: 'POST',
          url: integrationEndpoint,
          data: requestData,
        });
      },
      onSuccess: async () => {
        // it's important that we keep the mutation pending while the refetch is happening by awaiting it.
        // Otherwise, clicking toggles again while the invalidation is running won't do anything because they still see old defaultValues.
        // this makes the mutations seem to run longer than before. We could do optimistic updates here too, but I'm not sure it's worth the added complexity.
        await queryClient.invalidateQueries(integrationQueryOptions);

        if (provider.key === 'gcp') {
          try {
            await verifyGcpConnection();
          } catch (error) {
            // The save itself succeeded; the connection stays recorded as unverified
            // and the customer can re-test, so don't report this as a failed save.
            Sentry.captureException(error);
          }
        }
      },
    });

    return (
      <Fragment>
        {(integration.configOrganization?.length ?? 0) > 0 && (
          <FieldGroup
            title={
              integration.provider.aspects.configure_integration?.title ||
              t('Organization Integration Settings')
            }
          >
            {integration.configOrganization?.map(fieldConfig => (
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
      <IntegrationNavigationHeader integration={integration} action={getAction()} />
      {renderMainContent()}
    </Fragment>
  );
}

function IntegrationNavigationHeader({
  integration,
  action,
}: {
  integration: Integration;
  action?: React.ReactNode;
}) {
  const externalUrl = getIntegrationExternalUrl(integration);

  return (
    <Fragment>
      <SentryDocumentTitle title={integration.provider.name} />
      <SettingsPageHeader
        title={
          <Flex align="center" gap="sm">
            <Text as="span">{t('Configurations')}</Text>
            <Divider />
            <IntegrationIcon size={18} integration={integration} />
            {externalUrl ? (
              <Text>
                {textProps => (
                  <ExternalLink {...textProps} href={externalUrl}>
                    {integration.name}
                  </ExternalLink>
                )}
              </Text>
            ) : (
              <Text>{integration.name}</Text>
            )}
          </Flex>
        }
        action={action}
      />
      <BreadcrumbTitle title={integration.provider.name} />
    </Fragment>
  );
}

function getIntegrationExternalUrl(integration: Integration): string | null {
  const {domainName} = integration;
  if (!domainName) {
    return null;
  }

  if (/^https?:\/\//i.test(domainName)) {
    return domainName;
  }

  if (integration.provider.key === 'pagerduty') {
    return null;
  }

  return `https://${domainName}`;
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
