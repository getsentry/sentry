import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {removeSentryApp} from 'sentry/actionCreators/sentryApps';
import {ExternalLink} from 'sentry/components/core/link';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SentryApp} from 'sentry/types/integrations';
import {
  platformEventLinkMap,
  PlatformEvents,
} from 'sentry/utils/analytics/integrations/platformAnalyticsEvents';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import SentryApplicationRow from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationRow';
import CreateIntegrationButton from 'sentry/views/settings/organizationIntegrations/createIntegrationButton';
import ExampleIntegrationButton from 'sentry/views/settings/organizationIntegrations/exampleIntegrationButton';

type Tab = 'public' | 'internal';

const TAB_LABELS: Record<Tab, string> = {
  internal: t('Internal Integration'),
  public: t('Public Integration'),
};

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
  } = useApiQuery<SentryApp[]>([`/organizations/${organization.slug}/sentry-apps/`], {
    staleTime: 0,
  });

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

  const renderApplicationRow = (app: SentryApp) => {
    return (
      <SentryApplicationRow
        key={app.uuid}
        app={app}
        organization={organization}
        onRemoveApp={removeApp}
        onPublishSubmission={refetch}
      />
    );
  };

  const renderInternalIntegrations = () => {
    const integrations = applications.filter(
      (app: SentryApp) => app.status === 'internal'
    );
    const isEmpty = integrations.length === 0;

    return (
      <Panel>
        <PanelHeader>{t('Internal Integrations')}</PanelHeader>
        <PanelBody>
          {isEmpty ? (
            <EmptyMessage>
              {t('No internal integrations have been created yet.')}
            </EmptyMessage>
          ) : (
            integrations.map(renderApplicationRow)
          )}
        </PanelBody>
      </Panel>
    );
  };

  const renderPublicIntegrations = () => {
    const integrations = applications.filter(app => app.status !== 'internal');
    const isEmpty = integrations.length === 0;

    return (
      <Panel>
        <PanelHeader>{t('Public Integrations')}</PanelHeader>
        <PanelBody>
          {isEmpty ? (
            <EmptyMessage>
              {t('No public integrations have been created yet.')}
            </EmptyMessage>
          ) : (
            integrations.map(renderApplicationRow)
          )}
        </PanelBody>
      </Panel>
    );
  };

  const renderTabContent = () => {
    switch (tab) {
      case 'internal':
        return renderInternalIntegrations();
      case 'public':
      default:
        return renderPublicIntegrations();
    }
  };

  return (
    <div>
      <SentryDocumentTitle title={t('Custom Integrations')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Custom Integrations')}
        body={
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
        action={
          <Flex>
            <ExampleIntegrationButton
              analyticsView={analyticsView}
              style={{marginRight: space(1)}}
            />
            <CreateIntegrationButton analyticsView={analyticsView} />
          </Flex>
        }
      />
      <TabsContainer>
        <Tabs value={tab} onChange={setTab}>
          <TabList>
            {Object.entries(TAB_LABELS).map(([key, label]) => (
              <TabList.Item key={key}>{label}</TabList.Item>
            ))}
          </TabList>
        </Tabs>
      </TabsContainer>
      {renderTabContent()}
    </div>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

export default OrganizationDeveloperSettings;
