import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {formatTraceMetricsFunction} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useAddMetricToDashboard} from 'sentry/views/explore/metrics/hooks/useAddMetricToDashboard';
import {useSaveMetricsMultiQuery} from 'sentry/views/explore/metrics/hooks/useSaveMetricsMultiQuery';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  isVisualize,
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {getVisualizeLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

import {
  canUseMetricsAlertsUI,
  canUseMetricsEquationsInAlerts,
  canUseMetricsSavedQueriesUI,
} from './metricsFlags';

interface UseSaveAsMetricItemsOptions {
  interval: string;
}

export function useSaveAsMetricItems(options: UseSaveAsMetricItemsOptions) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const {saveQuery, updateQuery} = useSaveMetricsMultiQuery();
  const id = getIdFromLocation(location);
  const {data: savedQuery} = useGetSavedQuery(id);

  const metricQueries = useMultiMetricsQueryParams();
  const {addToDashboard} = useAddMetricToDashboard();

  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

  const saveAsItems = useMemo(() => {
    if (!canUseMetricsSavedQueriesUI(organization)) {
      return [];
    }

    const items = [];

    if (defined(id) && savedQuery?.isPrebuilt === false) {
      items.push({
        key: 'update-query',
        textValue: t('Existing Query'),
        label: <span>{t('Existing Query')}</span>,
        onAction: async () => {
          try {
            addLoadingMessage(t('Updating query...'));
            await updateQuery();
            addSuccessMessage(t('Query updated successfully'));
            trackAnalytics('metrics.save_as', {
              save_type: 'update_query',
              ui_source: 'searchbar',
              organization,
            });
          } catch (error) {
            addErrorMessage(t('Failed to update query'));
            Sentry.captureException(error);
          }
        },
      });
    }

    items.push({
      key: 'save-query',
      label: <span>{t('New Query')}</span>,
      textValue: t('New Query'),
      onAction: () => {
        trackAnalytics('metrics.save_query_modal', {
          action: 'open',
          save_type: 'save_new_query',
          ui_source: 'table',
          organization,
        });
        openSaveQueryModal({
          organization,
          saveQuery,
          source: 'table',
          traceItemDataset: TraceItemDataset.TRACEMETRICS,
        });
      },
    });

    return items;
  }, [id, savedQuery?.isPrebuilt, updateQuery, saveQuery, organization]);

  const saveAsAlertItems = useMemo(() => {
    if (!canUseMetricsAlertsUI(organization)) {
      return [];
    }

    const alertsUrls = metricQueries
      .filter(
        metricQuery =>
          canUseMetricsEquationsInAlerts(organization) ||
          isVisualizeFunction(metricQuery.queryParams.visualizes[0]!)
      )
      .map((metricQuery, index) => {
        const visualize = metricQuery.queryParams.visualizes[0]!;
        const yAxis = visualize.yAxis;

        const query = metricQuery.queryParams.query ?? '';
        let label = yAxis;
        if (isVisualizeFunction(visualize)) {
          const func = parseFunction(yAxis);
          label = func ? prettifyParsedFunction(func) : yAxis;
        } else if (isVisualizeEquation(visualize)) {
          label = metricQuery.label ?? '';
        }

        return {
          key: `create-alert-${index}`,
          label,
          to: getAlertsUrl({
            project,
            query,
            pageFilters: pageFilters.selection,
            aggregate: yAxis,
            organization,
            dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
            interval: options.interval,
            eventTypes: [EventTypes.TRACE_ITEM_METRIC],
          }),
          onAction: () => {
            trackAnalytics('metrics.save_as', {
              save_type: 'alert',
              ui_source: 'searchbar',
              organization,
            });
          },
        };
      });

    const newAlertLabel = organization.features.includes('workflow-engine-ui')
      ? t('Monitor for')
      : t('Alert for');

    return [
      {
        key: 'create-alert',
        label: newAlertLabel,
        textValue: newAlertLabel,
        children: alertsUrls,
        disabled: alertsUrls.length === 0,
        isSubmenu: true,
      },
    ];
  }, [metricQueries, organization, project, pageFilters, options.interval]);

  const addToDashboardItems = useMemo(() => {
    return [
      {
        key: 'add-to-dashboard',
        label: t('Dashboard widget'),
        textValue: t('Dashboard widget'),
        isSubmenu: true,
        children: [
          ...(metricQueries.length > 1
            ? [
                {
                  key: 'add-to-dashboard-all',
                  label: t('All Application Metrics'),
                  textValue: t('All Application Metrics'),
                  onAction: () => {
                    addToDashboard(
                      metricQueries.filter(
                        metricQuery =>
                          !isVisualizeEquation(metricQuery.queryParams.visualizes[0]!)
                      )
                    );
                  },
                },
              ]
            : []),
          ...metricQueries.map((metricQuery, index) => {
            const visualize = metricQuery.queryParams.visualizes[0]!;
            const label = isVisualizeFunction(visualize)
              ? `${metricQuery.label ?? getVisualizeLabel(index, isVisualizeEquation(visualize))}: ${
                  formatTraceMetricsFunction(
                    metricQuery.queryParams.aggregateFields
                      .filter(isVisualize)
                      .map(v => v.yAxis)
                  ) as string
                }`
              : (metricQuery.label ?? '');
            return {
              key: `add-to-dashboard-${index}`,
              label,
              onAction: () => {
                if (isVisualizeEquation(visualize)) {
                  return;
                }
                addToDashboard(metricQuery);
              },
              disabled: isVisualizeEquation(visualize),
              tooltip: isVisualizeEquation(visualize)
                ? t('Equations cannot currently be added to a dashboard')
                : undefined,
            };
          }),
        ],
      },
    ];
  }, [addToDashboard, metricQueries]);

  return useMemo(() => {
    return [...saveAsItems, ...saveAsAlertItems, ...addToDashboardItems];
  }, [saveAsItems, saveAsAlertItems, addToDashboardItems]);
}
