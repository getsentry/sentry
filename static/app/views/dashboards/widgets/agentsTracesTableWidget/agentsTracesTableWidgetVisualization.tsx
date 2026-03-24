import {useCallback} from 'react';
import type {Location} from 'history';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DashboardFilters} from 'sentry/views/dashboards/types';
import {DEFAULT_TRACES_TABLE_WIDTHS} from 'sentry/views/dashboards/utils/prebuiltConfigs/ai/aiAgentsOverview';
import {useTraceViewDrawer} from 'sentry/views/insights/pages/agents/components/drawer';
import {TracesTable} from 'sentry/views/insights/pages/agents/components/tracesTable';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

interface AgentsTracesTableWidgetVisualizationProps {
  dashboardFilters?: DashboardFilters;
  frameless?: boolean;
  isFullscreen?: boolean;
  limit?: number;
  tableWidths?: number[];
}

export function AgentsTracesTableWidgetVisualization({
  limit,
  tableWidths = DEFAULT_TRACES_TABLE_WIDTHS,
  dashboardFilters,
  frameless,
  isFullscreen,
}: AgentsTracesTableWidgetVisualizationProps) {
  const {openTraceViewDrawer} = useTraceViewDrawer();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const navigateToTraceView = useCallback(
    (traceSlug: string, _spanId?: string, timestamp?: number) => {
      navigate(
        getTraceDetailsUrl({
          organization,
          traceSlug,
          dateSelection: normalizeDateTimeParams(selection),
          timestamp,
          location: {query: {}} as Location,
          source: TraceViewSources.AGENT_MONITORING,
        })
      );
    },
    [navigate, organization, selection]
  );

  return (
    <TracesTable
      openTraceViewDrawer={isFullscreen ? navigateToTraceView : openTraceViewDrawer}
      limit={limit}
      tableWidths={tableWidths}
      dashboardFilters={dashboardFilters}
      frameless={frameless}
    />
  );
}
