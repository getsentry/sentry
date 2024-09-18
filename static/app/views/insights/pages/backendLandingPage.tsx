import {Fragment} from 'react';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import CachesLandingPage from 'sentry/views/insights/cache/views/cacheLandingPage';
import DatabaseLandingPage from 'sentry/views/insights/database/views//databaseLandingPage';
import HTTPLandingPage from 'sentry/views/insights/http/views/httpLandingPage';
import {OVERVIEW_PAGE_TITLE} from 'sentry/views/insights/pages/settings';
import {
  type Filters,
  useFilters,
  useUpdateFilters,
} from 'sentry/views/insights/pages/useFilters';
import QueuesLandingPage from 'sentry/views/insights/queues/views/queuesLandingPage';
import {MODULE_TITLES} from 'sentry/views/insights/settings';
import {type InsightLandingProps, ModuleName} from 'sentry/views/insights/types';

function BackendLandingPage() {
  const filters = useFilters();
  const updateFilters = useUpdateFilters();

  const landingPageProps: InsightLandingProps = {disableHeader: true};

  const crumbs: Crumb[] = [
    {
      label: t('Performance'),
      to: '/performance', // There is no page at `/insights/` so there is nothing to link to
      preservePageFilters: true,
    },
    {
      label: BACKEND_LANDING_TITLE,
      to: undefined,
      preservePageFilters: true,
    },
    {
      label: filters.module ? MODULE_TITLES[filters.module] : OVERVIEW_PAGE_TITLE,
      to: undefined,
      preservePageFilters: true,
    },
  ];

  const handleTabChange: (key: Filters['module']) => void = key => {
    if (key === filters.module || (key === OVERVIEW_PAGE_TITLE && !filters.module)) {
      return;
    }
    if (!key) {
      return;
    }
    if (key === OVERVIEW_PAGE_TITLE) {
      updateFilters({module: undefined});
      return;
    }
    updateFilters({module: key});
  };

  return (
    <Fragment>
      <Tabs value={filters.module || OVERVIEW_PAGE_TITLE} onChange={handleTabChange}>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} />

            <Layout.Title>{BACKEND_LANDING_TITLE}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <FeedbackWidgetButton />
            </ButtonBar>
          </Layout.HeaderActions>
          <TabList>
            <TabList.Item key={OVERVIEW_PAGE_TITLE}>{OVERVIEW_PAGE_TITLE}</TabList.Item>
            <TabList.Item key={ModuleName.DB}>
              {MODULE_TITLES[ModuleName.DB]}
            </TabList.Item>
            <TabList.Item key={ModuleName.HTTP}>
              {MODULE_TITLES[ModuleName.HTTP]}
            </TabList.Item>
            <TabList.Item key={ModuleName.CACHE}>
              {MODULE_TITLES[ModuleName.CACHE]}
            </TabList.Item>
            <TabList.Item key={ModuleName.QUEUE}>
              {MODULE_TITLES[ModuleName.QUEUE]}
            </TabList.Item>
          </TabList>
        </Layout.Header>
        <Layout.Main fullWidth>
          <PageAlert />
          <TabPanels>
            <TabPanels.Item key={OVERVIEW_PAGE_TITLE}>{'overview page'}</TabPanels.Item>
            <TabPanels.Item key={ModuleName.DB}>
              <DatabaseLandingPage {...landingPageProps} />
            </TabPanels.Item>
            <TabPanels.Item key={ModuleName.HTTP}>
              <HTTPLandingPage {...landingPageProps} />
            </TabPanels.Item>
            <TabPanels.Item key={ModuleName.CACHE}>
              <CachesLandingPage {...landingPageProps} />
            </TabPanels.Item>
            <TabPanels.Item key={ModuleName.QUEUE}>
              <QueuesLandingPage {...landingPageProps} />
            </TabPanels.Item>
          </TabPanels>
        </Layout.Main>
      </Tabs>
    </Fragment>
  );
}

export default BackendLandingPage;

export const BACKEND_LANDING_SUB_PATH = 'backend';
export const BACKEND_LANDING_TITLE = t('Backend');
