import {useCallback, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {defined} from 'sentry/utils';
import {encodeSort} from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {getTitleFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/title';
import {useInvalidateSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {isVisualize} from 'sentry/views/explore/queryParams/visualize';

const METRICS_DATASET = 'metrics';

export function useSaveMetricsMultiQuery() {
  const location = useLocation();
  const id = getIdFromLocation(location);
  const title = getTitleFromLocation(location);

  const metricQueries = useMultiMetricsQueryParams();

  const {selection} = usePageFilters();
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;
  const [interval] = useChartInterval();

  const api = useApi();
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();

  const data = useMemo(() => {
    return {
      name: title,
      isMultiQuery: true,
      dataset: METRICS_DATASET,
      start,
      end,
      range: period,
      interval,
      projects,
      environment: environments,
      query: metricQueries
        .map(metricQuery => {
          const groupBys = metricQuery.queryParams.aggregateFields
            .filter(field => isGroupBy(field))
            .map(field => ({groupBy: field.groupBy}));

          const visualizes = metricQuery.queryParams.aggregateFields.filter(field =>
            isVisualize(field)
          );

          const visualize = visualizes[0];

          if (!defined(visualize) || !visualize) {
            Sentry.captureException(new Error('No visualize found for metric query'));
            return null;
          }

          const yAxes = visualizes.map(v => v.yAxis); // There should only be one yAxis per metricQuery.
          const chartType = visualize.chartType;

          return {
            aggregateField: [
              ...groupBys,
              ...(yAxes.length > 0 ? [{yAxes, chartType}] : []),
            ],
            metric: metricQuery.metric,
            fields: metricQuery.queryParams.fields,
            orderby: metricQuery.queryParams.sortBys[0]
              ? encodeSort(metricQuery.queryParams.sortBys[0])
              : undefined,
            query: metricQuery.queryParams.query ?? '',
            mode: metricQuery.queryParams.mode,
          };
        })
        .filter(defined),
    };
  }, [title, start, end, period, interval, projects, environments, metricQueries]);

  const saveQuery = useCallback(
    async (newTitle: string, starred = true) => {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/`,
        {
          method: 'POST',
          data: {
            ...data,
            name: newTitle,
            starred,
          },
        }
      );
      invalidateSavedQueries();
      return response;
    },
    [api, organization.slug, data, invalidateSavedQueries]
  );

  const updateQuery = useCallback(async () => {
    const response = await api.requestPromise(
      `/organizations/${organization.slug}/explore/saved/${id}/`,
      {
        method: 'PUT',
        data,
      }
    );
    return response;
  }, [api, organization.slug, id, data]);

  return {saveQuery, updateQuery};
}
