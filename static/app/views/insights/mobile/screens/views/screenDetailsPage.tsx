import type React from 'react';
import {useState} from 'react';
import omit from 'lodash/omit';

import {FeatureBadge, type FeatureBadgeProps} from '@sentry/scraps/badge';
import {Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {PlatformizedAppStartsOverview} from 'sentry/views/insights/mobile/screens/views/platformizedAppStartsOverview';
import {PlatformizedScreenLoadsOverview} from 'sentry/views/insights/mobile/screens/views/platformizedScreenLoadsOverview';
import {PlatformizedScreenRenderingOverview} from 'sentry/views/insights/mobile/screens/views/platformizedScreenRenderingOverview';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName} from 'sentry/views/insights/types';

type Query = {
  project: string;
  tab: string | undefined;
  transaction: string;
};

export type TabKey = 'app_start' | 'screen_load' | 'screen_rendering';

type Tab = {
  content: () => React.ReactNode;
  key: TabKey;
  label: string;
  feature?: string;
  featureBadge?: FeatureBadgeProps['type'];
};

function ScreenDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation<Query>();
  const organization = useOrganization();

  const {transaction: transactionName} = location.query;
  const moduleName = ModuleName.MOBILE_VITALS;

  const tabs: Tab[] = [
    {
      key: 'app_start',
      label: t('App Start'),
      content: () => <PlatformizedAppStartsOverview key="app_start" />,
    },
    {
      key: 'screen_load',
      label: t('Screen Load'),
      content: () => <PlatformizedScreenLoadsOverview key="screen_load" />,
    },
    {
      key: 'screen_rendering',
      label: t('Screen Rendering'),
      featureBadge: 'experimental',
      content: () => <PlatformizedScreenRenderingOverview key="screen_rendering" />,
    },
  ];

  const getTabKeyFromQuery = () => {
    const queryTab = decodeScalar(location?.query?.tab);
    const selectedTab = tabs.find((tab: Tab) => tab.key === queryTab);
    return selectedTab?.key ?? tabs[0]!.key;
  };

  const [selectedTabKey, setSelectedTabKey] = useState(getTabKeyFromQuery());
  const moduleURL = useModuleURL(moduleName);

  function handleTabChange(tabKey: string) {
    setSelectedTabKey(tabKey as TabKey);

    const newQuery = {...location.query, tab: tabKey};

    navigate({
      pathname: location.pathname,
      query: omit(newQuery, 'field', 'query', 'referrer', 'sampling', 'sort', 'span.op'),
    });
  }

  const tabList = (
    <TabList>
      {tabs.map(tab => {
        const visible =
          tab.feature === undefined || organization.features.includes(tab.feature);
        return (
          <TabList.Item key={tab.key} hidden={!visible} textValue={tab.label}>
            {tab.label}
            {tab.featureBadge && <FeatureBadge type={tab.featureBadge} />}
          </TabList.Item>
        );
      })}
    </TabList>
  );

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={t('Mobile Vitals')} orgSlug={organization.slug} />
      <Stack flex={1}>
        <PageAlertProvider>
          <Tabs value={selectedTabKey} onChange={tabKey => handleTabChange(tabKey)}>
            <MobileHeader
              module={moduleName}
              hideDefaultTabs
              tabs={{tabList, value: selectedTabKey, onTabChange: handleTabChange}}
              headerTitle={transactionName}
              breadcrumbs={[
                {
                  label: t('Mobile Vitals'),
                  to: moduleURL,
                },
                {
                  label: t('Screen Summary'),
                },
              ]}
            />
            <Layout.Body>
              <Layout.Main width="full">
                <PageAlert />
                {tabs.filter(tab => tab.key === selectedTabKey).map(tab => tab.content())}
              </Layout.Main>
            </Layout.Body>
          </Tabs>
        </PageAlertProvider>
      </Stack>
    </PageFiltersContainer>
  );
}

export default ScreenDetailsPage;
