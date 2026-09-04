import {useMemo} from 'react';
import * as Sentry from '@sentry/react';
import {useMutation} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {encodeSort} from 'sentry/utils/discover/eventView';
import {fetchMutation} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useInvalidateSavedQueries,
  useInvalidateSavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {
  isVisualize,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

const METRICS_DATASET = 'metrics';

export function useSaveMetricsMultiQuery() {
  const location = useLocation();
  const id = decodeScalar(location.query.id);
  const title = decodeScalar(location.query.title);

  const metricQueries = useMultiMetricsQueryParams();

  const {selection} = usePageFilters();
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;
  const [interval] = useChartInterval();

  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const invalidateSavedQuery = useInvalidateSavedQuery(id);

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

          // There can be multiple yAxes per metricQuery, with multi-aggregate support.
          const yAxes = visualizes.map(v => v.yAxis);
          const chartType = visualize.chartType;

          return {
            aggregateField: [
              ...groupBys,
              ...(yAxes.length > 0 ? [{yAxes, chartType}] : []),
            ],
            ...(isVisualizeFunction(visualize) ? {metric: metricQuery.metric} : {}),
            fields: metricQuery.queryParams.fields,
            orderby: metricQuery.queryParams.sortBys[0]
              ? encodeSort(metricQuery.queryParams.sortBys[0])
              : undefined,
            aggregateOrderby: metricQuery.queryParams.aggregateSortBys[0]
              ? encodeSort(metricQuery.queryParams.aggregateSortBys[0])
              : undefined,
            query: metricQuery.queryParams.query ?? '',
            mode: metricQuery.queryParams.mode,
          };
        })
        .filter(defined),
    };
  }, [title, start, end, period, interval, projects, environments, metricQueries]);

  const {mutateAsync: saveQuery} = useMutation({
    mutationFn: ({name, starred = true}: {name: string; starred?: boolean}) =>
      fetchMutation<{id: string}>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/explore/saved/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data: {
          ...data,
          name,
          starred,
        },
      }),
    onSuccess: () => {
      invalidateSavedQueries();
    },
  });

  const {mutateAsync: updateQuery} = useMutation({
    mutationFn: () =>
      fetchMutation<{id: string}>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/explore/saved/$id/', {
          path: {organizationIdOrSlug: organization.slug, id: String(id)},
        }),
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      invalidateSavedQueries();
      invalidateSavedQuery();
    },
  });

  return {saveQuery, updateQuery};
}
