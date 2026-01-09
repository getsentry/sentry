import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {RequestOptions} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {Data, JsonFormObject} from 'sentry/components/forms/types';
import HookOrDefault from 'sentry/components/hookOrDefault';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {ObjectStatus} from 'sentry/types/core';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {
  getAlertText,
  getIntegrationStatus,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {
  AlertType,
  IntegrationTab,
} from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';
import IntegrationLayout from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';
import {useIntegrationTabs} from 'sentry/views/settings/organizationIntegrations/detailedView/useIntegrationTabs';
import InstalledIntegration from 'sentry/views/settings/organizationIntegrations/installedIntegration';
import IntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

// Show the features tab if the org has features for the integration
const integrationFeatures = ['github', 'gitlab', 'slack'];

const FirstPartyIntegrationAlert = HookOrDefault({
  hookName: 'component:first-party-integration-alert',
  defaultComponent: () => null,
});

const FirstPartyIntegrationAdditionalCTA = HookOrDefault({
  hookName: 'component:first-party-integration-additional-cta',
  defaultComponent: () => null,
});

export type IntegrationInformation = {
  providers: IntegrationProvider[];
};

function makeIntegrationQueryKey({
  orgSlug,
  integrationSlug,
}: {
  integrationSlug: string;
  orgSlug: string;
}): ApiQueryKey {
  return [
    `/organizations/${orgSlug}/integrations/`,
    {
      query: {
        provider_key: integrationSlug,
        includeConfig: 0,
      },
    },
  ];
}

export default function IntegrationDetailedView() {
  const tabs: IntegrationTab[] = useMemo(
    () => ['overview', 'configurations', 'features'],
    []
  );
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const {activeTab, setActiveTab} = useIntegrationTabs<IntegrationTab>({
    initialTab: 'overview',
  });
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const {integrationSlug} = useParams<{integrationSlug: string}>();

  const {
    data: information,
    isPending: isInformationPending,
    isError: isInformationError,
  } = useApiQuery<IntegrationInformation>(
    [
      `/organizations/${organization.slug}/config/integrations/`,
      {
        query: {
          provider_key: integrationSlug,
        },
      },
    ],
    {
      staleTime: Infinity,
      retry: false,
    }
  );

  const {
    data: configurations = [],
    isPending: isConfigurationsPending,
    isError: isConfigurationsError,
  } = useApiQuery<Integration[]>(
    makeIntegrationQueryKey({orgSlug: organization.slug, integrationSlug}),
    {
      staleTime: Infinity,
      retry: false,
    }
  );

  const integrationType = 'first_party';
  const provider = information?.providers[0];
  const description = provider?.metadata.description ?? '';
  const author = provider?.metadata.author ?? '';
  const resourceLinks = useMemo(() => {
    return [
      {url: provider?.metadata.source_url ?? '', title: 'View Source'},
      {url: provider?.metadata.issue_url ?? '', title: 'Report Issue'},
    ];
  }, [provider]);
  const alerts: AlertType[] = useMemo(() => {
    // The server response for integration installations includes old icon CSS classes
    // We map those to the currently in use values to their react equivalents
    // and fallback to IconFlag just in case.
    const alertList: AlertType[] = (provider?.metadata.aspects.alerts || []).map(
      alert => ({
        variant: alert.variant ?? 'muted',
        text: alert.text,
        icon: alert.icon,
      })
    );

    if (!provider?.canAdd && provider?.metadata.aspects.externalInstall) {
      alertList.push({
        variant: 'warning',
        text: provider?.metadata.aspects.externalInstall.noticeText,
      });
    }
    return alertList;
  }, [provider]);
  const installationStatus = useMemo(() => {
    const statusList = configurations?.map(getIntegrationStatus);
    // if we have conflicting statuses, we have a priority order
    if (statusList.includes('active')) {
      return 'Installed';
    }
    if (statusList.includes('disabled')) {
      return 'Disabled';
    }
    if (statusList.includes('pending_deletion')) {
      return 'Pending Deletion';
    }
    return 'Not Installed';
  }, [configurations]);
  const integrationName = provider?.name ?? '';
  const featureData = useMemo(() => {
    return provider?.metadata.features ?? [];
  }, [provider]);

  const onTabChange = useCallback(
    (tab: IntegrationTab) => {
      setActiveTab(tab);
      trackIntegrationAnalytics('integrations.integration_tab_clicked', {
        view: 'integrations_directory_integration_detail',
        integration: integrationSlug,
        integration_type: integrationType,
        already_installed: installationStatus !== 'Not Installed', // pending counts as installed here
        organization,
        integration_tab: tab,
      });
    },
    [setActiveTab, integrationSlug, integrationType, installationStatus, organization]
  );

  const renderTabs = useCallback(() => {
    const displayTabs = integrationFeatures.includes(provider?.key ?? '')
      ? tabs
      : tabs.filter(tab => tab !== 'features');

    return (
      <IntegrationLayout.Tabs
        tabs={displayTabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
    );
  }, [provider, tabs, activeTab, onTabChange]);

  const onInstall = useCallback(
    (integration: Integration) => {
      // send the user to the configure integration view for that integration
      navigate(
        `/settings/${organization.slug}/integrations/${integration.provider.key}/${integration.id}/`
      );
    },
    [organization.slug, navigate]
  );

  const onRemove = useCallback(
    (integration: Integration) => {
      const originalConfigurations = [...configurations];

      const updatedConfigurations = configurations.map(config =>
        config.id === integration.id
          ? {...config, organizationIntegrationStatus: 'pending_deletion' as ObjectStatus}
          : config
      );

      setApiQueryData<Integration[]>(
        queryClient,
        makeIntegrationQueryKey({orgSlug: organization.slug, integrationSlug}),
        updatedConfigurations
      );

      const options: RequestOptions = {
        method: 'DELETE',
        error: () => {
          setApiQueryData<Integration[]>(
            queryClient,
            makeIntegrationQueryKey({orgSlug: organization.slug, integrationSlug}),
            originalConfigurations
          );
          addErrorMessage(t('Failed to remove Integration'));
        },
      };

      // XXX: We can probably convert this to a mutation, but trying to avoid it for the FC conversion.
      api.request(
        `/organizations/${organization.slug}/integrations/${integration.id}/`,
        options
      );
    },
    [api, configurations, integrationSlug, organization.slug, queryClient]
  );

  const onDisable = useCallback((integration: Integration) => {
    let url: string;

    if (!integration.domainName) {
      return;
    }

    const [domainName, orgName] = integration.domainName.split('/');
    if (integration.accountType === 'User') {
      url = `https://${domainName}/settings/installations/`;
    } else {
      url = `https://${domainName}/organizations/${orgName}/settings/installations/`;
    }

    window.open(url, '_blank');
  }, []);

  const renderTopButton = useCallback(
    (disabledFromFeatures: boolean, userHasAccess: boolean) => {
      const queryParams = new URLSearchParams(location.search);
      const referrer = queryParams.get('referrer');

      const buttonProps = {
        size: 'sm',
        priority: 'primary',
        'data-test-id': 'install-button',
        disabled: disabledFromFeatures,
      } as const;

      if (!provider) {
        return null;
      }

      return (
        <IntegrationContext
          value={{
            provider,
            type: integrationType,
            installStatus: installationStatus,
            analyticsParams: {
              view: 'integrations_directory_integration_detail',
              already_installed: installationStatus !== 'Not Installed',
              ...(referrer && {referrer}),
            },
          }}
        >
          <StyledIntegrationButton
            userHasAccess={userHasAccess}
            onAddIntegration={onInstall}
            onExternalClick={() => {
              trackIntegrationAnalytics('integrations.installation_start', {
                view: 'integrations_directory_integration_detail',
                integration: integrationSlug,
                integration_type: integrationType,
                already_installed: installationStatus !== 'Not Installed',
                organization,
              });
            }}
            buttonProps={buttonProps}
          />
        </IntegrationContext>
      );
    },
    [
      provider,
      integrationType,
      installationStatus,
      onInstall,
      organization,
      integrationSlug,
      location.search,
    ]
  );

  const renderConfigurations = useCallback(() => {
    if (!configurations.length || !provider) {
      return (
        <IntegrationLayout.EmptyConfigurations
          action={
            <IntegrationLayout.AddInstallButton
              featureData={featureData}
              hideButtonIfDisabled
              requiresAccess
              renderTopButton={renderTopButton}
            />
          }
        />
      );
    }

    const alertText = getAlertText(configurations);

    return (
      <Fragment>
        {alertText && (
          <Alert.Container>
            <Alert variant="warning">{alertText}</Alert>
          </Alert.Container>
        )}
        <Panel>
          {configurations.map(integration => (
            <PanelItem key={integration.id}>
              <InstalledIntegration
                organization={organization}
                provider={provider}
                integration={integration}
                onRemove={onRemove}
                onDisable={onDisable}
                data-test-id={integration.id}
                trackIntegrationAnalytics={eventKey => {
                  trackIntegrationAnalytics(eventKey, {
                    view: 'integrations_directory_integration_detail',
                    integration: integrationSlug,
                    integration_type: integrationType,
                    already_installed: installationStatus !== 'Not Installed',
                    organization,
                  });
                }}
                requiresUpgrade={!!alertText}
              />
            </PanelItem>
          ))}
        </Panel>
      </Fragment>
    );
  }, [
    configurations,
    provider,
    onRemove,
    onDisable,
    featureData,
    installationStatus,
    integrationSlug,
    integrationType,
    organization,
    renderTopButton,
  ]);

  const getSlackFeatures = useCallback((): [JsonFormObject[], Data] => {
    const hasIntegration = configurations ? configurations.length > 0 : false;

    const forms: JsonFormObject[] = [
      {
        fields: [
          {
            name: 'issueAlertsThreadFlag',
            type: 'boolean',
            label: t('Enable Slack threads on Issue Alerts'),
            help: t(
              'Allow Slack integration to post replies in threads for an Issue Alert notification.'
            ),
            disabled: !hasIntegration,
            disabledReason: t(
              'You must have a Slack integration to enable this feature.'
            ),
          },
          {
            name: 'metricAlertsThreadFlag',
            type: 'boolean',
            label: t('Enable Slack threads on Metric Alerts'),
            help: t(
              'Allow Slack integration to post replies in threads for an Metric Alert notification.'
            ),
            disabled: !hasIntegration,
            disabledReason: t(
              'You must have a Slack integration to enable this feature.'
            ),
          },
        ],
      },
    ];

    const initialData = {
      issueAlertsThreadFlag: organization.issueAlertsThreadFlag,
      metricAlertsThreadFlag: organization.metricAlertsThreadFlag,
    };

    return [forms, initialData];
  }, [organization, configurations]);

  const getGithubFeatures = useCallback((): [JsonFormObject[], Data] => {
    const hasIntegration = configurations ? configurations.length > 0 : false;

    const forms: JsonFormObject[] = [
      {
        fields: [
          {
            name: 'githubPRBot',
            type: 'boolean',
            label: t('Enable Comments on Suspect Pull Requests'),
            help: t(
              'Allow Sentry to comment on recent pull requests suspected of causing issues.'
            ),
            disabled: !hasIntegration,
            disabledReason: t(
              'You must have a GitHub integration to enable this feature.'
            ),
          },
          {
            name: 'githubNudgeInvite',
            type: 'boolean',
            label: t('Enable Missing Member Detection'),
            help: t(
              'Allow Sentry to detect users committing to your GitHub repositories that are not part of your Sentry organization..'
            ),
            disabled: !hasIntegration,
            disabledReason: t(
              'You must have a GitHub integration to enable this feature.'
            ),
          },
        ],
      },
    ];

    const initialData = {
      githubPRBot: organization.githubPRBot,
      githubNudgeInvite: organization.githubNudgeInvite,
    };

    return [forms, initialData];
  }, [organization, configurations]);

  const getGitlabFeatures = useCallback((): [JsonFormObject[], Data] => {
    const hasIntegration = configurations ? configurations.length > 0 : false;

    const forms: JsonFormObject[] = [
      {
        fields: [
          {
            name: 'gitlabPRBot',
            type: 'boolean',
            label: t('Enable Comments on Suspect Pull Requests'),
            help: t(
              'Allow Sentry to comment on recent pull requests suspected of causing issues.'
            ),
            disabled: !hasIntegration,
            disabledReason: t(
              'You must have a GitLab integration to enable this feature.'
            ),
          },
        ],
      },
    ];

    const initialData = {
      gitlabPRBot: organization.gitlabPRBot,
    };

    return [forms, initialData];
  }, [organization, configurations]);

  const renderFeatures = useCallback(() => {
    const endpoint = `/organizations/${organization.slug}/`;
    const hasOrgWrite = organization.access.includes('org:write');

    let forms: JsonFormObject[], initialData: Data;
    switch (provider?.key) {
      case 'github': {
        [forms, initialData] = getGithubFeatures();
        break;
      }
      case 'gitlab': {
        [forms, initialData] = getGitlabFeatures();
        break;
      }
      case 'slack': {
        [forms, initialData] = getSlackFeatures();
        break;
      }
      default:
        return null;
    }

    return (
      <Form
        apiMethod="PUT"
        apiEndpoint={endpoint}
        saveOnBlur
        allowUndo
        initialData={initialData}
        onSubmitError={() => addErrorMessage('Unable to save change')}
      >
        <JsonForm
          disabled={!hasOrgWrite}
          features={organization.features}
          forms={forms}
        />
      </Form>
    );
  }, [organization, provider, getGithubFeatures, getGitlabFeatures, getSlackFeatures]);

  if (isInformationPending || isConfigurationsPending) {
    return <LoadingIndicator />;
  }

  if (isInformationError || isConfigurationsError) {
    return <LoadingError message={t('There was an error loading this integration.')} />;
  }

  return (
    <SentryDocumentTitle title={integrationName}>
      <IntegrationLayout.Body
        integrationName={integrationName}
        alert={<FirstPartyIntegrationAlert integrations={configurations} hideCTA />}
        topSection={
          <IntegrationLayout.TopSection
            featureData={featureData}
            integrationName={integrationName}
            installationStatus={installationStatus}
            integrationIcon={<PluginIcon pluginId={integrationSlug} size={50} />}
            addInstallButton={
              <IntegrationLayout.AddInstallButton
                featureData={featureData}
                hideButtonIfDisabled={false}
                requiresAccess
                renderTopButton={renderTopButton}
              />
            }
            additionalCTA={
              <FirstPartyIntegrationAdditionalCTA integrations={configurations} />
            }
          />
        }
        tabs={renderTabs()}
        content={
          activeTab === 'overview' ? (
            <IntegrationLayout.InformationCard
              integrationSlug={integrationSlug}
              description={description}
              alerts={alerts}
              featureData={featureData}
              author={author}
              resourceLinks={resourceLinks}
              permissions={null}
            />
          ) : activeTab === 'configurations' ? (
            renderConfigurations()
          ) : (
            renderFeatures()
          )
        }
      />
    </SentryDocumentTitle>
  );
}

const StyledIntegrationButton = styled(IntegrationButton)`
  margin-bottom: ${space(1)};
`;
