import {Fragment} from 'react';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import LLMLandingPage from 'sentry/views/insights/llmMonitoring/views/llmMonitoringLandingPage';
import {
  type Filters,
  useFilters,
  useUpdateFilters,
} from 'sentry/views/insights/pages/useFilters';
import {MODULE_TITLES} from 'sentry/views/insights/settings';
import {type InsightLandingProps, ModuleName} from 'sentry/views/insights/types';

function AiLandingPage() {
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
      label: AI_LANDING_TITLE,
      to: undefined,
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

            <Layout.Title>{AI_LANDING_TITLE}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <FeedbackWidgetButton />
            </ButtonBar>
          </Layout.HeaderActions>
          <TabList>
            <TabList.Item key="overview">{'Overview'}</TabList.Item>
            <TabList.Item key={ModuleName.AI}>
              {MODULE_TITLES[ModuleName.AI]}
            </TabList.Item>
          </TabList>
        </Layout.Header>
        <Layout.Main fullWidth>
          <PageAlert />
          <TabPanels>
            <TabPanels.Item key="overview">{'overview page'}</TabPanels.Item>
            <TabPanels.Item key={ModuleName.AI}>
              <LLMLandingPage {...landingPageProps} />
            </TabPanels.Item>
          </TabPanels>
        </Layout.Main>
      </Tabs>
    </Fragment>
  );
}

export default AiLandingPage;

export const AI_LANDING_SUB_PATH = 'ai';
export const AI_LANDING_TITLE = t('AI');
