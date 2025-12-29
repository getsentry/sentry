import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {formatTraceMetricsFunction} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import {useHasTraceMetricsDashboards} from 'sentry/views/dashboards/hooks/useHasTraceMetricsDashboards';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useAddMetricToDashboard} from 'sentry/views/explore/metrics/hooks/useAddMetricToDashboard';
import {useSaveMetricsMultiQuery} from 'sentry/views/explore/metrics/hooks/useSaveMetricsMultiQuery';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {isVisualize} from 'sentry/views/explore/queryParams/visualize';
import {getVisualizeLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';
import {TraceItemDataset} from 'sentry/views/explore/types';

import {canUseMetricsSavedQueriesUI} from './metricsFlags';

interface UseSaveAsMetricItemsOptions {
  interval: string;
}

export function useSaveAsMetricItems(_options: UseSaveAsMetricItemsOptions) {
  const location = useLocation();
  const organization = useOrganization();
  const {saveQuery, updateQuery} = useSaveMetricsMultiQuery();
  const id = getIdFromLocation(location);
  const {data: savedQuery} = useGetSavedQuery(id);

  const metricQueries = useMultiMetricsQueryParams();
  const hasTraceMetricsDashboards = useHasTraceMetricsDashboards();
  const {addToDashboard} = useAddMetricToDashboard();

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
      label: <span>{t('A New Query')}</span>,
      textValue: t('A New Query'),
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

  // TODO: Implement alert functionality when organizations:tracemetrics-alerts flag is enabled

  const addToDashboardItems = useMemo(() => {
    const items = [];

    if (hasTraceMetricsDashboards) {
      items.push({
        key: 'add-to-dashboard',
        label: <span>{t('A Dashboard widget')}</span>,
        textValue: t('A Dashboard widget'),
        isSubmenu: true,
        children: metricQueries.map((metricQuery, index) => {
          return {
            key: `add-to-dashboard-${index}`,
            label: `${getVisualizeLabel(index)}: ${
              formatTraceMetricsFunction(
                metricQuery.queryParams.aggregateFields.find(isVisualize)?.yAxis ?? ''
              ) as string
            }`,
            onAction: () => {
              addToDashboard(metricQuery);
            },
          };
        }),
      });
    }

    return items;
  }, [hasTraceMetricsDashboards, addToDashboard, metricQueries]);

  return useMemo(() => {
    return [...saveAsItems, ...addToDashboardItems];
  }, [saveAsItems, addToDashboardItems]);
}
