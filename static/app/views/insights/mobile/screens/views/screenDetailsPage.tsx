import type React from 'react';
import {useState} from 'react';
import {parseAsString, useQueryStates} from 'nuqs';

import {FeatureBadge, type FeatureBadgeProps} from '@sentry/scraps/badge';
import {Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName} from 'sentry/views/insights/types';

import {PlatformizedAppStartsOverview} from './platformizedAppStartsOverview';
import {PlatformizedScreenLoadsOverview} from './platformizedScreenLoadsOverview';
import {PlatformizedScreenRenderingOverview} from './platformizedScreenRenderingOverview';

const screenDetailsParsers = {
  tab: parseAsString,
  transaction: parseAsString.withDefault(''),
  field: parseAsString,
  query: parseAsString,
  referrer: parseAsString,
  sampling: parseAsString,
  sort: parseAsString,
  'span.op': parseAsString,
};

export type TabKey = 'app_start' | 'screen_load' | 'screen_rendering';

type Tab = {
  content: () => React.ReactNode;
  key: TabKey;
  label: string;
  featureBadge?: FeatureBadgeProps['type'];
};

function ScreenDetailsPage() {
  const [{tab: queryTab, transaction: transactionName}, setQueryParams] =
    useQueryStates(screenDetailsParsers);
  const organization = useOrganization();

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
    const selectedTab = tabs.find((tab: Tab) => tab.key === queryTab);
    return selectedTab?.key ?? tabs[0]!.key;
  };

  const [selectedTabKey, setSelectedTabKey] = useState(getTabKeyFromQuery());
  const moduleURL = useModuleURL(moduleName);

  function handleTabChange(tabKey: string) {
    setSelectedTabKey(tabKey as TabKey);

    setQueryParams(
      {
        tab: tabKey,
        field: null,
        query: null,
        referrer: null,
        sampling: null,
        sort: null,
        'span.op': null,
      },
      {history: 'push'}
    );
  }

  const tabList = (
    <TabList>
      {tabs.map(tab => {
        return (
          <TabList.Item key={tab.key} textValue={tab.label}>
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
              breadcrumbs={[{type: 'link', label: t('Mobile Vitals'), to: moduleURL}]}
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
