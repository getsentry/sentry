import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboardingPanel} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {
  type DomainView,
  useDomainViewFilters,
} from 'sentry/views/insights/pages/useFilters';
import CrashFreeSessionsChart from 'sentry/views/insights/sessions/charts/crashFreeSessionsChart';
import ErrorFreeSessionsChart from 'sentry/views/insights/sessions/charts/errorFreeSessionsChart';
import NewAndResolvedIssueChart from 'sentry/views/insights/sessions/charts/newAndResolvedIssueChart';
import ReleaseNewIssuesChart from 'sentry/views/insights/sessions/charts/releaseNewIssuesChart';
import ReleaseSessionCountChart from 'sentry/views/insights/sessions/charts/releaseSessionCountChart';
import ReleaseSessionPercentageChart from 'sentry/views/insights/sessions/charts/releaseSessionPercentageChart';
import SessionHealthCountChart from 'sentry/views/insights/sessions/charts/sessionHealthCountChart';
import SessionHealthRateChart from 'sentry/views/insights/sessions/charts/sessionHealthRateChart';
import UserHealthCountChart from 'sentry/views/insights/sessions/charts/userHealthCountChart';
import UserHealthRateChart from 'sentry/views/insights/sessions/charts/userHealthRateChart';
import FilterReleaseDropdown from 'sentry/views/insights/sessions/components/filterReleaseDropdown';
import GiveFeedbackSection from 'sentry/views/insights/sessions/components/giveFeedbackSection';
import ReleaseHealth from 'sentry/views/insights/sessions/components/tables/releaseHealth';
import useProjectHasSessions from 'sentry/views/insights/sessions/queries/useProjectHasSessions';
import {ModuleName} from 'sentry/views/insights/types';

export function SessionsOverview() {
  const {view = ''} = useDomainViewFilters();
  const [filters, setFilters] = useState<string[]>(['']);

  // only show onboarding if the project does not have session data
  const hasSessionData = useProjectHasSessions();
  const showOnboarding = !hasSessionData;

  return (
    <Fragment>
      <ViewSpecificHeader view={view} />
      <Layout.Body>
        <Layout.Main fullWidth>
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ToolRibbon>
                <ModulePageFilterBar
                  moduleName={ModuleName.SESSIONS}
                  extraFilters={<SubregionSelector />}
                  onProjectChange={() => {
                    setFilters(['']);
                  }}
                />
              </ToolRibbon>
            </ModuleLayout.Full>
            {showOnboarding ? (
              <ModuleLayout.Full>
                <ModulesOnboardingPanel moduleName={ModuleName.SESSIONS} />
              </ModuleLayout.Full>
            ) : (
              <ViewSpecificCharts view={view} filters={filters} setFilters={setFilters} />
            )}
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

function ViewSpecificHeader({view}: {view: DomainView | ''}) {
  switch (view) {
    case FRONTEND_LANDING_SUB_PATH:
      return <FrontendHeader module={ModuleName.SESSIONS} />;
    case MOBILE_LANDING_SUB_PATH:
      return <MobileHeader module={ModuleName.SESSIONS} />;
    default:
      return null;
  }
}

function ViewSpecificCharts({
  view,
  filters,
  setFilters,
}: {
  filters: string[];
  setFilters: (filter: string[]) => void;
  view: DomainView | '';
}) {
  switch (view) {
    case FRONTEND_LANDING_SUB_PATH:
      return (
        <Fragment>
          <ModuleLayout.Half>
            <ErrorFreeSessionsChart />
          </ModuleLayout.Half>
          <ModuleLayout.Half>
            <UserHealthRateChart />
          </ModuleLayout.Half>

          <ModuleLayout.Third>
            <UserHealthCountChart />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <NewAndResolvedIssueChart type="issue" />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <SessionHealthRateChart />
          </ModuleLayout.Third>

          <ModuleLayout.Third>
            <SessionHealthCountChart />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <NewAndResolvedIssueChart type="feedback" />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <GiveFeedbackSection />
          </ModuleLayout.Third>
        </Fragment>
      );

    case MOBILE_LANDING_SUB_PATH:
      return (
        <Fragment>
          <ModuleLayout.Half>
            <CrashFreeSessionsChart />
          </ModuleLayout.Half>
          <ModuleLayout.Half>
            <ReleaseSessionPercentageChart />
          </ModuleLayout.Half>

          <ModuleLayout.Third>
            <ReleaseNewIssuesChart />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <ReleaseSessionCountChart />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <SessionHealthCountChart />
          </ModuleLayout.Third>

          <ModuleLayout.Third>
            <UserHealthCountChart />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <NewAndResolvedIssueChart type="issue" />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <SessionHealthRateChart />
          </ModuleLayout.Third>

          <ModuleLayout.Third>
            <UserHealthRateChart />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <NewAndResolvedIssueChart type="feedback" />
          </ModuleLayout.Third>
          <ModuleLayout.Third>
            <GiveFeedbackSection />
          </ModuleLayout.Third>

          <ModuleLayout.Full>
            <FilterWrapper>
              <FilterReleaseDropdown filters={filters} setFilters={setFilters} />
            </FilterWrapper>
            <ReleaseHealth filters={filters} />
          </ModuleLayout.Full>
        </Fragment>
      );
    default:
      return null;
  }
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="sessions">
      <SessionsOverview />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const FilterWrapper = styled('div')`
  display: flex;
  margin: ${space(2)} 0;
`;
