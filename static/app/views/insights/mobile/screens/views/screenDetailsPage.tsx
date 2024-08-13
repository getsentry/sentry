import type React from 'react';
import {useState} from 'react';
import type {Location} from 'history';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TabList, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {browserHistory} from 'sentry/utils/browserHistory';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {ScreenSummaryContentPage as AppStartPage} from 'sentry/views/insights/mobile/appStarts/views/screenSummaryPage';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import {ScreenLoadSpansContent as ScreenLoadPage} from 'sentry/views/insights/mobile/screenload/views/screenLoadSpansPage';
import {ScreenSummaryContent as UiPage} from 'sentry/views/insights/mobile/ui/views/screenSummaryPage';
import {ModuleName} from 'sentry/views/insights/types';

type Query = {
  project: string;
  tab: string | undefined;
  transaction: string;
};

type Tab = {
  content: () => React.ReactNode;
  key: string;
  label: string;
  alpha?: boolean | undefined;
  feature?: string | undefined;
};

export function ScreenDetailsPage() {
  const location: Location = useLocation<Query>();
  const organization = useOrganization();
  const {isProjectCrossPlatform} = useCrossPlatformProject();

  const {transaction: transactionName} = location.query;
  const moduleName = ModuleName.MOBILE_SCREENS;
  const crumbs = [
    ...useModuleBreadcrumbs(moduleName),
    {
      label: transactionName,
    },
  ];

  const tabs: Tab[] = [
    {
      key: 'app_start',
      label: t('App Start'),
      content: () => {
        return <AppStartPage key={'app_start'} />;
      },
    },
    {
      key: 'screen_load',
      label: t('Screen Load'),
      content: () => {
        return <ScreenLoadPage key={'screen_load'} />;
      },
    },
    {
      key: 'screen_rendering',
      label: t('Screen Rendering'),
      feature: 'starfish-mobile-ui-module',
      alpha: true,
      content: () => {
        return <UiPage key={'screen_rendering'} />;
      },
    },
  ];

  const getTabKeyFromQuery = () => {
    const queryTab = decodeScalar(location?.query?.tab);
    const selectedTab = tabs.find((tab: Tab) => tab.key === queryTab);
    return selectedTab?.key ?? tabs[0].key;
  };

  const [selectedTabKey, setSelectedTabKey] = useState(getTabKeyFromQuery());

  function handleTabChange(tabKey: string) {
    setSelectedTabKey(tabKey);

    const newQuery = {...location.query, tab: tabKey};

    browserHistory.push({
      pathname: location.pathname,
      query: newQuery,
    });
  }

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={t('Mobile Screens')} orgSlug={organization.slug} />
      <Layout.Page>
        <PageAlertProvider>
          <Tabs value={selectedTabKey} onChange={tabKey => handleTabChange(tabKey)}>
            <Layout.Header>
              <Layout.HeaderContent style={{margin: 0}}>
                <Breadcrumbs crumbs={crumbs} />
                <Layout.Title>{transactionName}</Layout.Title>
              </Layout.HeaderContent>
              <Layout.HeaderActions>
                <ButtonBar gap={1}>
                  {isProjectCrossPlatform && <PlatformSelector />}
                </ButtonBar>
              </Layout.HeaderActions>

              <TabList hideBorder>
                {tabs.map(tab => {
                  const visible =
                    tab.feature === undefined ||
                    organization.features?.includes(tab.feature);
                  return (
                    <TabList.Item key={tab.key} hidden={!visible} textValue={tab.label}>
                      {tab.label}
                      {tab.alpha && <FeatureBadge type="alpha" variant={'badge'} />}
                    </TabList.Item>
                  );
                })}
              </TabList>
            </Layout.Header>
            <Layout.Body>
              <Layout.Main fullWidth>
                <PageAlert />
                {tabs.filter(tab => tab.key === selectedTabKey).map(tab => tab.content())}
              </Layout.Main>
            </Layout.Body>
          </Tabs>
        </PageAlertProvider>
      </Layout.Page>
    </PageFiltersContainer>
  );
}

export default ScreenDetailsPage;
