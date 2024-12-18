import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {TabList, Tabs} from 'sentry/components/tabs';
import {IconBusiness} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {useModuleTitles} from 'sentry/views/insights/common/utils/useModuleTitle';
import {
  type RoutableModuleNames,
  useModuleURLBuilder,
} from 'sentry/views/insights/common/utils/useModuleURL';
import {
  DOMAIN_VIEW_BASE_TITLE,
  OVERVIEW_PAGE_TITLE,
} from 'sentry/views/insights/pages/settings';
import {isModuleEnabled} from 'sentry/views/insights/pages/utils';
import type {ModuleName} from 'sentry/views/insights/types';

export type Props = {
  domainBaseUrl: string;
  domainTitle: string;
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
  label: React.ReactNode;
  to: LocationDescriptor;
};

export function DomainViewHeader({
  modules,
  headerTitle,
  domainTitle,
  selectedModule,
  hideDefaultTabs,
  additonalHeaderActions,
  additionalBreadCrumbs = [],
  domainBaseUrl,
  tabs,
}: Props) {
  const organization = useOrganization();
  const moduleURLBuilder = useModuleURLBuilder();
  const moduleTitles = useModuleTitles();

  const baseCrumbs: Crumb[] = [
    {
      label: DOMAIN_VIEW_BASE_TITLE,
      to: undefined, // There is no base /performance/ page
      preservePageFilters: true,
    },
    {
      label: domainTitle,
      to: domainBaseUrl,
      preservePageFilters: true,
    },
    {
      label: selectedModule ? moduleTitles[selectedModule] : OVERVIEW_PAGE_TITLE,
      to: selectedModule
        ? `${moduleURLBuilder(selectedModule as RoutableModuleNames)}/`
        : domainBaseUrl,
      preservePageFilters: true,
    },
    ...additionalBreadCrumbs,
  ];

  const showModuleTabs = organization.features.includes('insights-entry-points');

  const tabValue =
    hideDefaultTabs && tabs?.value ? tabs.value : selectedModule ?? OVERVIEW_PAGE_TITLE;

  const tabList: Tab[] = [
    {
      key: OVERVIEW_PAGE_TITLE,
      label: OVERVIEW_PAGE_TITLE,
      to: domainBaseUrl,
    },
  ];

  if (showModuleTabs) {
    tabList.push(
      ...modules.map(moduleName => ({
        key: moduleName,
        label: <TabLabel moduleName={moduleName} />,
        to: `${moduleURLBuilder(moduleName as RoutableModuleNames)}/`,
      }))
    );
  }

  return (
    <Fragment>
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
        <Tabs value={tabValue} onChange={tabs?.onTabChange}>
          {!hideDefaultTabs && (
            <TabList hideBorder>
              {tabList.map(tab => (
                <TabList.Item key={tab.key} to={tab.to}>
                  {tab.label}
                </TabList.Item>
              ))}
            </TabList>
          )}
          {hideDefaultTabs && tabs && tabs.tabList}
        </Tabs>
      </Layout.Header>
    </Fragment>
  );
}

function TabLabel({moduleName}: {moduleName: ModuleName}) {
  const moduleTitles = useModuleTitles();
  const organization = useOrganization();
  const showBusinessIcon = !isModuleEnabled(moduleName, organization);
  if (showBusinessIcon) {
    return (
      <TabWithIconContainer>
        {moduleTitles[moduleName]}
        <IconBusiness />
      </TabWithIconContainer>
    );
  }
  return <Fragment>{moduleTitles[moduleName]}</Fragment>;
}

const TabWithIconContainer = styled('div')`
  display: inline-flex;
  align-items: center;
  text-align: left;
  gap: ${space(0.5)};
`;
