import {useMemo} from 'react';

import {openCreateDashboardFromScratchpad} from 'sentry/actionCreators/modal';
import {convertToDashboardWidget} from 'sentry/utils/metrics/dashboard';
import {MetricQueryType, type MetricQueryWidgetParams} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {useDDMContext} from 'sentry/views/ddm/context';

export function useCreateDashboard() {
  const router = useRouter();
  const organization = useOrganization();
  const {widgets, isMultiChartMode} = useDDMContext();
  const {selection} = usePageFilters();

  const dashboardWidgets = useMemo(() => {
    // TODO(aknaus): Remove filtering once dashboard supports metrics formulas
    const supportedQueries = widgets.filter(
      widget => widget.type === MetricQueryType.QUERY
    ) as MetricQueryWidgetParams[];
    if (!isMultiChartMode) {
      return [convertToDashboardWidget(supportedQueries, widgets[0].displayType)];
    }

    return supportedQueries.map(query =>
      convertToDashboardWidget([query], query.displayType)
    );
  }, [widgets, isMultiChartMode]);

  return useMemo(() => {
    return function () {
      const newDashboard = {
        title: 'Metrics Dashboard',
        description: '',
        widgets: dashboardWidgets.slice(0, 30),
        projects: selection.projects,
        environment: selection.environments,
        start: selection.datetime.start as string,
        end: selection.datetime.end as string,
        period: selection.datetime.period as string,
        filters: {},
        utc: selection.datetime.utc ?? false,
        id: 'ddm-scratchpad',
        dateCreated: '',
      };

      openCreateDashboardFromScratchpad({newDashboard, router, organization});
    };
  }, [selection, organization, router, dashboardWidgets]);
}
