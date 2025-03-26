import {useCallback, useMemo} from 'react';

import {encodeSort} from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useExplorePageParams} from 'sentry/views/explore/contexts/pageParamsContext';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';

const TRACE_EXPLORER_DATASET = 'spans';

export function useSaveQuery() {
  const {groupBys, sortBys, visualizes, fields, query, mode, id, title} =
    useExplorePageParams();
  const {selection} = usePageFilters();
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;
  const [interval] = useChartInterval();

  const api = useApi();
  const organization = useOrganization();

  const visualize = visualizes.map(({chartType, yAxes}) => ({
    chartType,
    yAxes,
  }));

  const data = useMemo(() => {
    return {
      name: title,
      dataset: TRACE_EXPLORER_DATASET, // Only supported for trace explorer for now
      start,
      end,
      range: period,
      interval,
      projects,
      environment: environments,
      query: [
        {
          fields,
          orderby: sortBys[0] ? encodeSort(sortBys[0]) : undefined,
          groupby: groupBys.filter(groupBy => groupBy !== ''),
          query: query ?? '',
          visualize,
          mode,
        },
      ],
    };
  }, [
    groupBys,
    sortBys,
    visualize,
    fields,
    query,
    mode,
    start,
    end,
    period,
    interval,
    projects,
    environments,
    title,
  ]);

  const saveQuery = useCallback(
    async (newTitle: string) => {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/`,
        {
          method: 'POST',
          data: {
            ...data,
            name: newTitle,
          },
        }
      );
      return response;
    },
    [api, organization.slug, data]
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
