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
  AI_LANDING_SUB_PATH,
  AI_LANDING_TITLE,
} from 'sentry/views/insights/pages/ai/settings';
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
export function AiHeader({module}: Props) {
  const navigate = useNavigate();
  const {slug} = useOrganization();
  const moduleURLBuilder = useModuleURLBuilder();

  const aiBaseUrl = normalizeUrl(
    `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${AI_LANDING_SUB_PATH}/`
  );

  const crumbs: Crumb[] = [
    {
      label: t('Performance'),
      to: '/performance', // There is no page at `/insights/` so there is nothing to link to
      preservePageFilters: true,
    },
    {
      label: AI_LANDING_TITLE,
      to: aiBaseUrl,
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
      navigate(aiBaseUrl);
      return;
    }
    navigate(`${moduleURLBuilder(key as RoutableModuleNames)}/`);
  };

  return (
    <Fragment>
      <Tabs value={module ?? OVERVIEW_PAGE_TITLE} onChange={handleTabChange}>
        <Layout.HeaderContent>
          <Breadcrumbs crumbs={crumbs} />

          <Layout.Title>{AI_LANDING_TITLE}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <FeedbackWidgetButton />
          </ButtonBar>
        </Layout.HeaderActions>
        <TabList hideBorder>
          <TabList.Item key={OVERVIEW_PAGE_TITLE}>{OVERVIEW_PAGE_TITLE}</TabList.Item>
          <TabList.Item key={ModuleName.AI}>{MODULE_TITLES[ModuleName.AI]}</TabList.Item>
        </TabList>
      </Tabs>
    </Fragment>
  );
}
