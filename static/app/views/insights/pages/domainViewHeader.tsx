import {Fragment} from 'react';
import styled from '@emotion/styled';
import {IconBusiness} from '@sentry/icons/business';

import {FeatureBadge} from '@sentry/scraps/badge';
import type {
  BreadcrumbListProps,
  BreadcrumbTitleItem,
} from '@sentry/scraps/breadcrumbList';
import type {TabListItemProps} from '@sentry/scraps/tabs';
import {TabList} from '@sentry/scraps/tabs';

import * as Layout from 'sentry/components/layouts/thirds';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useModuleTitles} from 'sentry/views/insights/common/utils/useModuleTitle';
import {
  useModuleURLBuilder,
  type RoutableModuleNames,
} from 'sentry/views/insights/common/utils/useModuleURL';
import {ModuleName} from 'sentry/views/insights/types';
import {TopBar} from 'sentry/views/navigation/topBar';

import {useIsLaravelInsightsAvailable} from './platform/laravel/features';
import {useIsNextJsInsightsAvailable} from './platform/nextjs/features';
import {OVERVIEW_PAGE_TITLE} from './settings';
import {useDomainViewFilters} from './useFilters';
import {
  isModuleConsideredNew,
  isModuleEnabled,
  isModuleInBeta,
  isModuleVisible,
} from './utils';

export type Props = {
  domainBaseUrl: string;
  domainTitle: string;
  modules: ModuleName[];
  selectedModule: ModuleName | undefined;
  additionalBreadCrumbs?: BreadcrumbListProps['items'];
  additonalHeaderActions?: React.ReactNode;
  headerTitle?: string | BreadcrumbTitleItem;
  hideDefaultTabs?: boolean;
  tabs?: {onTabChange: (key: string) => void; tabList: React.ReactNode; value: string};
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
  const location = useLocation();
  const moduleURLBuilder = useModuleURLBuilder();
  const isLaravelInsightsAvailable = useIsLaravelInsightsAvailable();
  const isNextJsInsightsAvailable = useIsNextJsInsightsAvailable();
  const {view, isInOverviewPage} = useDomainViewFilters();

  const isLaravelInsights = isLaravelInsightsAvailable && isInOverviewPage;
  const isNextJsInsights = isNextJsInsightsAvailable && isInOverviewPage;
  const isAgentMonitoring = view === 'ai-agents';
  const isSessionsInsights = selectedModule === ModuleName.SESSIONS;

  const tabValue =
    hideDefaultTabs && tabs?.value ? tabs.value : (selectedModule ?? OVERVIEW_PAGE_TITLE);

  const globalQuery = {
    ...extractSelectionParameters(location?.query),
  };

  // The domain link is only useful when there is a deeper page below it;
  // otherwise the domain itself is the current page title.
  const breadcrumbItems: BreadcrumbListProps['items'] | undefined =
    additionalBreadCrumbs.length > 0
      ? [
          {
            type: 'link',
            label: domainTitle,
            to: {pathname: domainBaseUrl, query: globalQuery},
          },
          ...additionalBreadCrumbs,
        ]
      : undefined;

  const tabList: TabListItemProps[] = [
    {
      key: OVERVIEW_PAGE_TITLE,
      children: OVERVIEW_PAGE_TITLE,
      to: {pathname: domainBaseUrl, query: globalQuery},
    },
    ...modules
      .filter(moduleName => isModuleVisible(moduleName, organization))
      .map(moduleName => ({
        key: moduleName,
        children: <TabLabel moduleName={moduleName} />,
        textValue: moduleName,
        to: {
          pathname: `${moduleURLBuilder(moduleName as RoutableModuleNames)}/`,
          query: globalQuery,
        },
      })),
  ];

  const feedbackConfig: Array<[boolean, {owner: string; source: string}]> = [
    [isAgentMonitoring, {owner: 'telemetry-experience', source: 'agent-monitoring'}],
    [!!isLaravelInsights, {owner: 'performance', source: 'laravel-insights'}],
    [isSessionsInsights, {owner: 'replay', source: 'sessions-insights'}],
    [!!isNextJsInsights, {owner: 'performance', source: 'nextjs-insights'}],
  ];

  const activeFeedback = feedbackConfig.find(([condition]) => condition)?.[1];

  const feedbackOptions = activeFeedback
    ? {
        tags: {
          'feedback.source': activeFeedback.source,
          'feedback.owner': activeFeedback.owner,
        },
      }
    : undefined;
  return (
    <Fragment>
      <Layout.Header>
        <TopBar.Slot
          name="breadcrumbs"
          title={
            typeof headerTitle === 'object'
              ? headerTitle
              : {type: 'page-title', label: headerTitle || domainTitle}
          }
          items={breadcrumbItems}
        />
        {additonalHeaderActions && (
          <TopBar.Slot name="actions">{additonalHeaderActions}</TopBar.Slot>
        )}
        <TopBar.Slot name="feedback" feedbackOptions={feedbackOptions} />
        <Layout.HeaderTabs value={tabValue} onChange={tabs?.onTabChange}>
          {!hideDefaultTabs && (
            <TabList>
              {tabList.map(tab => (
                <TabList.Item {...tab} key={tab.key} />
              ))}
            </TabList>
          )}
          {hideDefaultTabs && tabs?.tabList}
        </Layout.HeaderTabs>
      </Layout.Header>
    </Fragment>
  );
}

interface TabLabelProps {
  moduleName: ModuleName;
}

function TabLabel({moduleName}: TabLabelProps) {
  const moduleTitles = useModuleTitles();
  const organization = useOrganization();
  const showBusinessIcon = !isModuleEnabled(moduleName, organization);

  const hasTrailingBadge =
    showBusinessIcon || isModuleConsideredNew(moduleName) || isModuleInBeta(moduleName);

  if (hasTrailingBadge) {
    return (
      <TabContainer>
        {moduleTitles[moduleName]}
        {isModuleConsideredNew(moduleName) && <FeatureBadge type="new" />}
        {isModuleInBeta(moduleName) && <FeatureBadge type="beta" />}
        {showBusinessIcon && <IconBusiness />}
      </TabContainer>
    );
  }

  return moduleTitles[moduleName];
}

const TabContainer = styled('div')`
  display: inline-flex;
  align-items: center;
  text-align: left;
  gap: ${p => p.theme.space.md};
`;
