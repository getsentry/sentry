import {useCallback, useMemo} from 'react';

import {openCreateDashboardFromMetrics} from 'sentry/actionCreators/modal';
import {isVirtualMetric} from 'sentry/utils/metrics';
import {convertToDashboardWidget} from 'sentry/utils/metrics/dashboard';
import {
  isMetricsEquationWidget,
  type MetricDisplayType,
  MetricExpressionType,
  type MetricsWidget,
} from 'sentry/utils/metrics/types';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import type {Widget} from 'sentry/views/dashboards/types';
import type {useFormulaDependencies} from 'sentry/views/metrics/utils/useFormulaDependencies';

export function useCreateDashboard(
  widgets: MetricsWidget[],
  formulaDependencies: ReturnType<typeof useFormulaDependencies>,
  isMultiChartMode: boolean
) {
  const router = useRouter();
  const {resolveVirtualMRI} = useVirtualMetricsContext();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const convertWidget = useCallback(
    (metricsQueries: MetricsWidget[], displayType: MetricDisplayType) => {
      const resolvedwidgets = metricsQueries.map(widget => {
        if (
          isMetricsEquationWidget(widget) ||
          !isVirtualMetric(widget) ||
          !widget.condition
        ) {
          return widget;
        }

        const {mri, aggregation} = resolveVirtualMRI(
          widget.mri,
          widget.condition,
          widget.aggregation
        );
        return {
          ...widget,
          mri,
          aggregation,
        };
      });

      return convertToDashboardWidget(resolvedwidgets, displayType);
    },
    [resolveVirtualMRI]
  );

  const dashboardWidgets = useMemo(() => {
    if (!isMultiChartMode) {
      const queryIdsInArray = new Set<number>();
      const widgetsWithDependencies = widgets.reduce<MetricsWidget[]>((acc, widget) => {
        if (isMetricsEquationWidget(widget)) {
          const {dependencies, isError} = formulaDependencies[widget.id]!;
          if (isError) {
            return acc;
          }
          // Only add dependencies that are not already in the list of widgets
          const filteredDependencies: MetricsWidget[] = [];
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
      }, []);
      return [convertWidget(widgetsWithDependencies, widgets[0]!.displayType)];
    }

    return widgets
      .map(widget => {
        if (widget.type !== MetricExpressionType.EQUATION) {
          return convertWidget([widget], widget.displayType);
        }

        const {dependencies, isError} = formulaDependencies[widget.id]!;

        if (isError) {
          return null;
        }
        return convertWidget(
          [...dependencies.map(query => ({...query, isHidden: true})), widget],
          widget.displayType
        );
      })
      .filter((widget): widget is Widget => widget !== null);
  }, [isMultiChartMode, widgets, convertWidget, formulaDependencies]);

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

      openCreateDashboardFromMetrics({newDashboard, router, organization});
    };
  }, [selection, organization, router, dashboardWidgets]);
}
