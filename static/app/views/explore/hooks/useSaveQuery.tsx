import {useCallback} from 'react';

import {encodeSort} from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useExplorePageParams} from 'sentry/views/explore/contexts/pageParamsContext';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';

const TRACE_EXPLORER_DATASET = 'ourlogs';

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

  const saveQuery = useCallback(
    async (newTitle: string) => {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/`,
        {
          method: 'POST',
          data: {
            name: newTitle,
            dataset: TRACE_EXPLORER_DATASET, // Only supported for trace explorer for now
            groupby: groupBys,
            orderby: sortBys[0] ? encodeSort(sortBys[0]) : undefined,
            visualize,
            fields,
            query: query ?? '',
            mode,
            start,
            end,
            range: period,
            interval,
            projects,
            environment: environments,
          },
        }
      );
      return response;
    },
    [
      api,
      organization.slug,
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
    ]
  );

  const updateQuery = useCallback(async () => {
    const response = await api.requestPromise(
      `/organizations/${organization.slug}/explore/saved/${id}/`,
      {
        method: 'PUT',
        data: {
          name: title,
          dataset: TRACE_EXPLORER_DATASET,
          groupby: groupBys,
          orderby: sortBys[0] ? encodeSort(sortBys[0]) : undefined,
          visualize,
          fields,
          query: query ?? '',
          mode,
          start,
          end,
          range: period,
          interval,
          projects,
        },
      }
    );
    return response;
  }, [
    api,
    organization.slug,
    id,
    title,
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
  ]);

  return {saveQuery, updateQuery};
}
