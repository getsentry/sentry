import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Key} from '@react-types/shared';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import {TabList} from 'sentry/components/tabs';
import type {TabListItemProps} from 'sentry/components/tabs/item';
import {IconBusiness, IconLab} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {useModuleTitles} from 'sentry/views/insights/common/utils/useModuleTitle';
import {
  type RoutableModuleNames,
  useModuleURLBuilder,
} from 'sentry/views/insights/common/utils/useModuleURL';
import {useIsLaravelInsightsAvailable} from 'sentry/views/insights/pages/platform/laravel/features';
import {OVERVIEW_PAGE_TITLE} from 'sentry/views/insights/pages/settings';
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
  const navigate = useNavigate();
  const moduleURLBuilder = useModuleURLBuilder();
  const isLaravelInsightsAvailable = useIsLaravelInsightsAvailable();
  const useEap = useInsightsEap();
  const hasEapFlag = organization.features.includes('insights-modules-use-eap');

  const toggleUseEap = () => {
    const newState = !useEap;

    navigate({
      ...location,
      query: {
        ...location.query,
        useEap: newState ? '1' : '0',
      },
    });
  };

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
    useEap: location.query?.useEap,
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

  const handleExperimentDropdownAction = (key: Key) => {
    if (key === 'eap') {
      toggleUseEap();
    }
  };

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          {crumbs.length > 1 && <Breadcrumbs crumbs={crumbs} />}
          <Layout.Title>{headerTitle || domainTitle}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            {selectedModule === ModuleName.SESSIONS ? (
              <FeedbackButtonTour />
            ) : (
              <FeedbackWidgetButton
                optionOverrides={
                  isLaravelInsightsAvailable
                    ? {
                        tags: {
                          ['feedback.source']: 'laravel-insights',
                          ['feedback.owner']: 'telemetry-experience',
                        },
                      }
                    : undefined
                }
              />
            )}
            {additonalHeaderActions}
            {hasEapFlag && (
              <Fragment>
                <DropdownMenu
                  trigger={triggerProps => (
                    <StyledDropdownButton {...triggerProps} size={'sm'}>
                      {/* Passing icon as child to avoid extra icon margin */}
                      <IconLab isSolid />
                    </StyledDropdownButton>
                  )}
                  onAction={handleExperimentDropdownAction}
                  items={[
                    {
                      key: 'eap',
                      label: useEap
                        ? 'Switch to Metrics Dataset'
                        : 'Switch to EAP Dataset',
                    },
                  ]}
                  position="bottom-end"
                />
              </Fragment>
            )}
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
          {hideDefaultTabs && tabs && tabs.tabList}
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

const StyledDropdownButton = styled(DropdownButton)`
  color: ${p => p.theme.button.primary.background};
  :hover {
    color: ${p => p.theme.button.primary.background};
  }
`;
