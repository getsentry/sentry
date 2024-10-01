import {Fragment} from 'react';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {TabList, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  type RoutableModuleNames,
  useModuleURLBuilder,
} from 'sentry/views/insights/common/utils/useModuleURL';
import {
  BACKEND_LANDING_SUB_PATH,
  BACKEND_LANDING_TITLE,
} from 'sentry/views/insights/pages/backend/settings';
import {
  DOMAIN_VIEW_BASE_URL,
  OVERVIEW_PAGE_TITLE,
} from 'sentry/views/insights/pages/settings';
import {MODULE_TITLES} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';

type Props = {
  module?: ModuleName;
};

// TODO - add props to append to breadcrumbs and change title
export function BackendHeader({module}: Props) {
  const navigate = useNavigate();
  const {slug} = useOrganization();
  const moduleURLBuilder = useModuleURLBuilder();

  const backendBaseUrl = normalizeUrl(
    `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${BACKEND_LANDING_SUB_PATH}/`
  );

  const crumbs: Crumb[] = [
    {
      label: t('Performance'),
      to: '/performance', // There is no page at `/insights/` so there is nothing to link to
      preservePageFilters: true,
    },
    {
      label: BACKEND_LANDING_TITLE,
      to: backendBaseUrl,
      preservePageFilters: true,
    },
    {
      label: module ? MODULE_TITLES[module] : OVERVIEW_PAGE_TITLE,
      to: undefined,
      preservePageFilters: true,
    },
  ];

  const handleTabChange = (key: ModuleName | typeof OVERVIEW_PAGE_TITLE) => {
    if (key === module || (key === OVERVIEW_PAGE_TITLE && !module)) {
      return;
    }
    if (!key) {
      return;
    }
    if (key === OVERVIEW_PAGE_TITLE) {
      navigate(backendBaseUrl);
      return;
    }
    navigate(`${moduleURLBuilder(key as RoutableModuleNames)}/`);
  };

  return (
    <Fragment>
      <Tabs value={module ?? OVERVIEW_PAGE_TITLE} onChange={handleTabChange}>
        <Layout.HeaderContent>
          <Breadcrumbs crumbs={crumbs} />

          <Layout.Title>{BACKEND_LANDING_TITLE}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <FeedbackWidgetButton />
          </ButtonBar>
        </Layout.HeaderActions>
        <TabList hideBorder>
          <TabList.Item key={OVERVIEW_PAGE_TITLE}>{OVERVIEW_PAGE_TITLE}</TabList.Item>
          <TabList.Item key={ModuleName.DB}>{MODULE_TITLES[ModuleName.DB]}</TabList.Item>
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
      </Tabs>
    </Fragment>
  );
}
