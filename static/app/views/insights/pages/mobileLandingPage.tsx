import {Fragment} from 'react';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import ScreensLandingPage from 'sentry/views/insights/mobile/screens/views/screensLandingPage';
import {OVERVIEW_PAGE_TITLE} from 'sentry/views/insights/pages/settings';
import {
  type Filters,
  useFilters,
  useUpdateFilters,
} from 'sentry/views/insights/pages/useFilters';
import {MODULE_TITLES} from 'sentry/views/insights/settings';
import {type InsightLandingProps, ModuleName} from 'sentry/views/insights/types';

function MobileLandingPage() {
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
      label: MOBILE_LANDING_TITLE,
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

            <Layout.Title>{MOBILE_LANDING_TITLE}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <FeedbackWidgetButton />
            </ButtonBar>
          </Layout.HeaderActions>
          <TabList>
            <TabList.Item key={OVERVIEW_PAGE_TITLE}>{OVERVIEW_PAGE_TITLE}</TabList.Item>
            <TabList.Item key={ModuleName.MOBILE_SCREENS}>
              {MODULE_TITLES[ModuleName.MOBILE_SCREENS]}
            </TabList.Item>
          </TabList>
        </Layout.Header>
        <Layout.Main fullWidth>
          <PageAlert />
          <TabPanels>
            <TabPanels.Item key={OVERVIEW_PAGE_TITLE}>{'overview page'}</TabPanels.Item>
            <TabPanels.Item key={ModuleName.MOBILE_SCREENS}>
              <ScreensLandingPage {...landingPageProps} />
            </TabPanels.Item>
          </TabPanels>
        </Layout.Main>
      </Tabs>
    </Fragment>
  );
}

export default MobileLandingPage;

export const MOBILE_LANDING_SUB_PATH = 'mobile';
export const MOBILE_LANDING_TITLE = t('Mobile');
