import {Fragment} from 'react';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {TabList, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  type RoutableModuleNames,
  useModuleURLBuilder,
} from 'sentry/views/insights/common/utils/useModuleURL';
import {OVERVIEW_PAGE_TITLE} from 'sentry/views/insights/pages/settings';
import {isModuleEnabled} from 'sentry/views/insights/pages/utils';
import {MODULE_TITLES} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

type Props = {
  domainBaseUrl: string;
  headerTitle: React.ReactNode;
  modules: ModuleName[];
  selectedModule: ModuleName | undefined;
  additionalBreadCrumbs?: Crumb[];
  additonalHeaderActions?: React.ReactNode;
  hideDefaultTabs?: boolean;
  tabs?: {onTabChange: (key: string) => void; tabList: React.ReactNode; value: string};
};

type Tab = {
  key: string;
  label: string;
};

export function DomainViewHeader({
  modules,
  headerTitle,
  selectedModule,
  hideDefaultTabs,
  additonalHeaderActions,
  additionalBreadCrumbs = [],
  domainBaseUrl,
  tabs,
}: Props) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const moduleURLBuilder = useModuleURLBuilder();

  const baseCrumbs: Crumb[] = [
    {
      label: t('Performance'),
      to: undefined, // There is no base /performance/ page
      preservePageFilters: true,
    },
    {
      label: headerTitle,
      to: domainBaseUrl,
      preservePageFilters: true,
    },
    {
      label: selectedModule ? MODULE_TITLES[selectedModule] : OVERVIEW_PAGE_TITLE,
      to: `${moduleURLBuilder(selectedModule as RoutableModuleNames)}/`,
      preservePageFilters: true,
    },
    ...additionalBreadCrumbs,
  ];

  const filteredModules = filterEnabledModules(modules, organization);

  const defaultHandleTabChange = (key: ModuleName | typeof OVERVIEW_PAGE_TITLE) => {
    if (key === selectedModule || (key === OVERVIEW_PAGE_TITLE && !module)) {
      return;
    }
    if (!key) {
      return;
    }
    if (key === OVERVIEW_PAGE_TITLE) {
      navigate(domainBaseUrl);
      return;
    }
    navigate(`${moduleURLBuilder(key as RoutableModuleNames)}/`);
  };

  const tabValue =
    hideDefaultTabs && tabs?.value ? tabs.value : selectedModule ?? OVERVIEW_PAGE_TITLE;

  const handleTabChange =
    hideDefaultTabs && tabs ? tabs.onTabChange : defaultHandleTabChange;

  const tabList: Tab[] = [
    {
      key: OVERVIEW_PAGE_TITLE,
      label: OVERVIEW_PAGE_TITLE,
    },
    ...filteredModules.map(moduleName => ({
      key: moduleName,
      label: MODULE_TITLES[moduleName],
    })),
  ];

  return (
    <Fragment>
      <Tabs value={tabValue} onChange={handleTabChange}>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={baseCrumbs} />

            <Layout.Title>{headerTitle}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              {additonalHeaderActions}
              <FeedbackWidgetButton />
            </ButtonBar>
          </Layout.HeaderActions>
          {!hideDefaultTabs && (
            <TabList hideBorder>
              {tabList.map(tab => (
                <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
              ))}
            </TabList>
          )}
          {hideDefaultTabs && tabs && tabs.tabList}
        </Layout.Header>
      </Tabs>
    </Fragment>
  );
}

const filterEnabledModules = (modules: ModuleName[], organization: Organization) => {
  return modules.filter(module => isModuleEnabled(module, organization));
};
