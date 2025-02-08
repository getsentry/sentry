import React from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import type {SessionApiResponse} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {ModuleName} from 'sentry/views/insights/types';

export function SessionsOverview() {
  const headerProps = {
    module: ModuleName.SESSIONS,
  };

  const {view} = useDomainViewFilters();
  const location = useLocation();
  const organization = useOrganization();
  const {
    data: sessionsData,
    isPending,
    error,
  } = useApiQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {query: {...location.query, field: ['sum(session)'], groupBy: ['session.status']}},
    ],
    {staleTime: 0}
  );

  if (!sessionsData) {
    return null;
  }

  // Get the healthy sessions series data
  const healthySessionsSeries =
    sessionsData.groups.find(group => group.by['session.status'] === 'healthy')?.series[
      'sum(session)'
    ] ?? [];

  // Calculate total sessions for each interval
  const totalSessionsByInterval = sessionsData.groups[0]?.series['sum(session)']?.map(
    (_, intervalIndex) =>
      sessionsData.groups.reduce(
        (acc, group) => acc + (group.series['sum(session)']?.[intervalIndex] ?? 0),
        0
      )
  );

  // Calculate percentage for each interval
  const healthySessionsPercentageData = healthySessionsSeries.map((healthyCount, idx) => {
    const total = totalSessionsByInterval?.[idx] ?? 1;
    return total > 0 ? healthyCount / total : 0;
  });

  return (
    <React.Fragment>
      {view === FRONTEND_LANDING_SUB_PATH && <FrontendHeader {...headerProps} />}
      <Layout.Body>
        <Layout.Main fullWidth>
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ToolRibbon>
                <ModulePageFilterBar
                  moduleName={ModuleName.SESSIONS}
                  extraFilters={<SubregionSelector />}
                />
              </ToolRibbon>
            </ModuleLayout.Full>
            <ModuleLayout.Third>
              <InsightsLineChartWidget
                title={t('Error Free Session Rate')}
                series={[
                  {
                    data: healthySessionsPercentageData.map((val, idx) => {
                      return {name: sessionsData.intervals[idx] ?? '', value: val};
                    }),
                    seriesName: 'Error free session rate',
                    meta: {
                      fields: {
                        'Error free session rate': 'percentage',
                        time: 'date',
                      },
                      units: {
                        'Error free session rate': '%',
                      },
                    },
                  },
                ]}
                isLoading={isPending}
                error={error}
              />
            </ModuleLayout.Third>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </React.Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="http"
      analyticEventName="insight.page_loads.sessions"
    >
      <SessionsOverview />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
