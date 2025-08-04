import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import type {TabListItemProps} from 'sentry/components/core/tabs';
import {TabList} from 'sentry/components/core/tabs';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import {IconBusiness} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useModuleTitles} from 'sentry/views/insights/common/utils/useModuleTitle';
import {
  type RoutableModuleNames,
  useModuleURLBuilder,
} from 'sentry/views/insights/common/utils/useModuleURL';
import {useIsLaravelInsightsAvailable} from 'sentry/views/insights/pages/platform/laravel/features';
import {useIsNextJsInsightsAvailable} from 'sentry/views/insights/pages/platform/nextjs/features';
import {OVERVIEW_PAGE_TITLE} from 'sentry/views/insights/pages/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {
  isModuleConsideredNew,
  isModuleEnabled,
  isModuleVisible,
} from 'sentry/views/insights/pages/utils';
import FeedbackButtonTour from 'sentry/views/insights/sessions/components/tour/feedbackButtonTour';
import {ModuleName} from 'sentry/views/insights/types';

export type Props = {
  domainBaseUrl: string;
  domainTitle: string;
  modules: ModuleName[];
  selectedModule: ModuleName | undefined;
  additionalBreadCrumbs?: Crumb[];
  additonalHeaderActions?: React.ReactNode;
  // TODO - hasOverviewPage could be improved, the overview page could just be a "module", but that has a lot of other implications that have to be considered
  hasOverviewPage?: boolean;
  headerTitle?: React.ReactNode;
  hideDefaultTabs?: boolean;
  tabs?: {onTabChange: (key: string) => void; tabList: React.ReactNode; value: string};
};

export function DomainViewHeader({
  modules,
  hasOverviewPage = true,
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
  const isAgentMonitoring = view === 'agents';

  const crumbs: Crumb[] = [
    {
      label: domainTitle,
      to: domainBaseUrl,
      preservePageFilters: true,
    },
    ...additionalBreadCrumbs,
  ];

  const tabValue =
    hideDefaultTabs && tabs?.value ? tabs.value : (selectedModule ?? OVERVIEW_PAGE_TITLE);

  const globalQuery = {
    ...extractSelectionParameters(location?.query),
  };

  const tabList: TabListItemProps[] = [
    ...(hasOverviewPage
      ? [
          {
            key: OVERVIEW_PAGE_TITLE,
            children: OVERVIEW_PAGE_TITLE,
            to: {pathname: domainBaseUrl, query: globalQuery},
          },
        ]
      : []),
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

  const feedbackOptions =
    isAgentMonitoring || isLaravelInsights || isNextJsInsights
      ? {
          tags: {
            ['feedback.source']: isAgentMonitoring
              ? 'agent-monitoring'
              : isLaravelInsights
                ? 'laravel-insights'
                : 'nextjs-insights',
            ['feedback.owner']: 'telemetry-experience',
          },
        }
      : undefined;
  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          {crumbs.length > 1 && <Breadcrumbs crumbs={crumbs} />}
          <Layout.Title>{headerTitle || domainTitle}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar>
            {selectedModule === ModuleName.SESSIONS ? (
              <FeedbackButtonTour />
            ) : (
              <FeedbackWidgetButton optionOverrides={feedbackOptions} />
            )}
            {additonalHeaderActions}
          </ButtonBar>
        </Layout.HeaderActions>
        <Layout.HeaderTabs value={tabValue} onChange={tabs?.onTabChange}>
          {!hideDefaultTabs && (
            <TabList hideBorder>
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

  if (showBusinessIcon || isModuleConsideredNew(moduleName)) {
    return (
      <TabContainer>
        {moduleTitles[moduleName]}
        {isModuleConsideredNew(moduleName) && <FeatureBadge type="new" />}
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
  gap: ${space(0.5)};
`;
