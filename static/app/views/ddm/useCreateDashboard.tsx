import {useMemo} from 'react';

import {openCreateDashboardFromScratchpad} from 'sentry/actionCreators/modal';
import {convertToDashboardWidget} from 'sentry/utils/metrics/dashboard';
import {MetricQueryType, type MetricWidgetQueryParams} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import type {Widget} from 'sentry/views/dashboards/types';
import type {useFormulaDependencies} from 'sentry/views/ddm/utils/useFormulaDependencies';

export function useCreateDashboard(
  widgets: MetricWidgetQueryParams[],
  formulaDependencies: ReturnType<typeof useFormulaDependencies>,
  isMultiChartMode: boolean
) {
  const router = useRouter();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const dashboardWidgets = useMemo(() => {
    if (!isMultiChartMode) {
      const queryIdsInArray = new Set<number>();
      const widgetsWithDependencies = widgets.reduce<MetricWidgetQueryParams[]>(
        (acc, widget) => {
          if (widget.type === MetricQueryType.FORMULA) {
            const {dependencies, isError} = formulaDependencies[widget.id];
            if (isError) {
              return acc;
            }
            // Only add dependencies that are not already in the list of widgets
            const filteredDependencies: MetricWidgetQueryParams[] = [];
            dependencies.forEach(dependency => {
              if (!queryIdsInArray.has(dependency.id)) {
                filteredDependencies.push({...dependency, isHidden: true});
                queryIdsInArray.add(dependency.id);
              }
            });

            return [...filteredDependencies, ...acc, widget];
          }

          if (queryIdsInArray.has(widget.id)) {
            return acc;
          }
          queryIdsInArray.add(widget.id);
          return [...acc, widget];
        },
        []
      );
      return [convertToDashboardWidget(widgetsWithDependencies, widgets[0].displayType)];
    }

    return widgets
      .map(widget => {
        if (widget.type !== MetricQueryType.FORMULA) {
          return convertToDashboardWidget([widget], widget.displayType);
        }

        const {dependencies, isError} = formulaDependencies[widget.id];

        if (isError) {
          return null;
        }
        return convertToDashboardWidget(
          [...dependencies.map(query => ({...query, isHidden: true})), widget],
          widget.displayType
        );
      })
      .filter((widget): widget is Widget => widget !== null);
  }, [isMultiChartMode, widgets, formulaDependencies]);

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
