import {Fragment} from 'react';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import ResourcesLandingPage from 'sentry/views/insights/browser/resources/views/resourcesLandingPage';
import WebVitalsLandingPage from 'sentry/views/insights/browser/webVitals/views/webVitalsLandingPage';
import HTTPLandingPage from 'sentry/views/insights/http/views/httpLandingPage';
import {
  type Filters,
  useFilters,
  useUpdateFilters,
} from 'sentry/views/insights/pages/useFilters';
import {MODULE_TITLES} from 'sentry/views/insights/settings';
import {type InsightLandingProps, ModuleName} from 'sentry/views/insights/types';

function WebLandingPage() {
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
      label: FRONTEND_LANDING_TITLE,
      to: '/performance/web',
      preservePageFilters: true,
    },
    {
      label: filters.module ? MODULE_TITLES[filters.module] : 'Overview',
      to: undefined,
      preservePageFilters: true,
    },
  ];

  const handleTabChange: (key: Filters['module']) => void = key => {
    if (key === filters.module || (key === 'overview' && !filters.module)) {
      return;
    }
    if (!key) {
      return;
    }
    if (key === 'overview') {
      updateFilters({module: undefined});
      return;
    }
    updateFilters({module: key});
  };

  return (
    <Fragment>
      <Tabs value={filters.module || 'overview'} onChange={handleTabChange}>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} />

            <Layout.Title>{FRONTEND_LANDING_TITLE}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <FeedbackWidgetButton />
            </ButtonBar>
          </Layout.HeaderActions>
          <TabList>
            <TabList.Item key="overview">{'Overview'}</TabList.Item>
            <TabList.Item key={ModuleName.VITAL}>
              {MODULE_TITLES[ModuleName.VITAL]}
            </TabList.Item>
            <TabList.Item key={ModuleName.HTTP}>
              {MODULE_TITLES[ModuleName.HTTP]}
            </TabList.Item>
            <TabList.Item key={ModuleName.RESOURCE}>
              {MODULE_TITLES[ModuleName.RESOURCE]}
            </TabList.Item>
          </TabList>
        </Layout.Header>
        <Layout.Main fullWidth>
          <PageAlert />
          <TabPanels>
            <TabPanels.Item key="overview">{'overview page'}</TabPanels.Item>
            <TabPanels.Item key={ModuleName.HTTP}>
              <HTTPLandingPage {...landingPageProps} />
            </TabPanels.Item>
            <TabPanels.Item key={ModuleName.RESOURCE}>
              <ResourcesLandingPage {...landingPageProps} />
            </TabPanels.Item>
            <TabPanels.Item key={ModuleName.VITAL}>
              <WebVitalsLandingPage {...landingPageProps} />
            </TabPanels.Item>
          </TabPanels>
        </Layout.Main>
      </Tabs>
    </Fragment>
  );
}

export default WebLandingPage;

export const FRONTEND_LANDING_SUB_PATH = 'frontend';
export const FRONTEND_LANDING_TITLE = t('Frontend');
