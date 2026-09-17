import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {removeSentryApp, sentryAppsApiOptions} from 'sentry/actionCreators/sentryApps';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {SentryApp} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {
  platformEventLinkMap,
  PlatformEvents,
} from 'sentry/utils/analytics/integrations/platformAnalyticsEvents';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {SentryApplicationRow} from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationRow';
import {CreateIntegrationButton} from 'sentry/views/settings/organizationIntegrations/createIntegrationButton';
import {ExampleIntegrationButton} from 'sentry/views/settings/organizationIntegrations/exampleIntegrationButton';

type Tab = 'public' | 'internal';

const TAB_LABELS: Record<Tab, string> = {
  internal: t('Internal Integration'),
  public: t('Public Integration'),
};

function IntegrationPanel({
  applications,
  emptyMessage,
  onPublishSubmission,
  onRemoveApp,
  organization,
  title,
}: {
  applications: SentryApp[];
  emptyMessage: string;
  onPublishSubmission: () => void;
  onRemoveApp: (app: SentryApp) => void;
  organization: Organization;
  title: string;
}) {
  return (
    <Panel>
      <PanelHeader>{title}</PanelHeader>
      <PanelBody>
        {applications.length === 0 ? (
          <EmptyMessage>{emptyMessage}</EmptyMessage>
        ) : (
          applications.map(app => (
            <SentryApplicationRow
              key={app.uuid}
              app={app}
              organization={organization}
              onRemoveApp={onRemoveApp}
              onPublishSubmission={onPublishSubmission}
            />
          ))
        )}
      </PanelBody>
    </Panel>
  );
}

function OrganizationDeveloperSettings() {
  const location = useLocation();
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});

  const value =
    ['public', 'internal'].find(tab => tab === location?.query?.type) || 'internal';
  const analyticsView = 'developer_settings';

  const [tab, setTab] = useState<Tab>(value as Tab);
  const [applicationsState, setApplicationsState] = useState<SentryApp[] | undefined>(
    undefined
  );

  const {
    data: fetchedApplications,
    isPending,
    isError,
    refetch,
  } = useQuery(sentryAppsApiOptions({orgSlug: organization.slug}));

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const applications = applicationsState ?? fetchedApplications;

  const removeApp = (app: SentryApp) => {
    const apps = applications.filter(a => a.slug !== app.slug);
    removeSentryApp(api, app).then(
      () => setApplicationsState(apps),
      () => {}
    );
  };

  const inlineActions = (
    <Flex gap="md">
      <ExampleIntegrationButton analyticsView={analyticsView} size="md" />
      <CreateIntegrationButton analyticsView={analyticsView} size="md" />
    </Flex>
  );

  const isInternalTab = tab === 'internal';
  const integrations = applications.filter(app =>
    isInternalTab ? app.status === 'internal' : app.status !== 'internal'
  );

  return (
    <div>
      <SentryDocumentTitle title={t('Custom Integrations')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Custom Integrations')}
        subtitle={
          <Fragment>
            {t(
              'Create integrations that interact with Sentry using the REST API and webhooks. '
            )}
            <br />
            {tct('For more information [link: see our docs].', {
              link: (
                <ExternalLink
                  href={platformEventLinkMap[PlatformEvents.DOCS]}
                  onClick={() => {
                    trackIntegrationAnalytics(PlatformEvents.DOCS, {
                      organization,
                      view: analyticsView,
                    });
                  }}
                />
              ),
            })}
          </Fragment>
        }
      />
      <TabsContainer>
        <Flex align="center" justify="between" gap="md">
          <Tabs value={tab} onChange={setTab}>
            <TabList>
              {Object.entries(TAB_LABELS).map(([key, label]) => (
                <TabList.Item key={key}>{label}</TabList.Item>
              ))}
            </TabList>
          </Tabs>
          {inlineActions}
        </Flex>
      </TabsContainer>
      <IntegrationPanel
        applications={integrations}
        emptyMessage={
          isInternalTab
            ? t('No internal integrations have been created yet.')
            : t('No public integrations have been created yet.')
        }
        onPublishSubmission={refetch}
        onRemoveApp={removeApp}
        organization={organization}
        title={isInternalTab ? t('Internal Integrations') : t('Public Integrations')}
      />
    </div>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};
`;

export default OrganizationDeveloperSettings;
