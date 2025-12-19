import {Fragment, useEffect, useState} from 'react';

import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';

import type {
  GenericWidgetQueriesChildrenProps,
  OnDataFetchedProps,
} from './genericWidgetQueries';

type PreprodWidgetQueriesProps = {
  children: (props: GenericWidgetQueriesChildrenProps) => React.JSX.Element;
  selection: PageFilters;
  widget: Widget;
  dashboardFilters?: never;
  limit?: never;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: OnDataFetchedProps) => void;
};

interface AppSizeResponse {
  data: Array<[number, Array<{count: number | null}>]>;
  end: number;
  meta: {
    fields: Record<string, string>;
  };
  start: number;
}

function PreprodWidgetQueries({
  children,
  selection,
  widget,
  onDataFetchStart,
  onDataFetched,
}: PreprodWidgetQueriesProps) {
  const api = useApi();
  const organization = useOrganization();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [timeseriesResults, setTimeseriesResults] = useState<Series[] | undefined>(
    undefined
  );
  const [tableResults, setTableResults] = useState<TableDataWithTitle[] | undefined>(
    undefined
  );
  const [timeseriesResultsTypes, setTimeseriesResultsTypes] = useState<
    Record<string, AggregationOutputType> | undefined
  >(undefined);

  // Serialize to avoid infinite loops from object reference changes
  const serializedQueries = JSON.stringify(widget.queries);
  const serializedSelection = JSON.stringify({
    datetime: selection.datetime,
    projects: selection.projects,
    environments: selection.environments,
  });

  console.log('[PreprodWidgetQueries] Serialized queries:', serializedQueries);
  console.log('[PreprodWidgetQueries] Widget queries:', widget.queries);

  useEffect(() => {
    console.log('[PreprodWidgetQueries] useEffect triggered, fetching data...');
    const fetchData = async () => {
      setLoading(true);
      onDataFetchStart?.();
      setErrorMessage(undefined);

      try {
        const isTableDisplay = widget.displayType === DisplayType.TABLE;

        // Build query params for each widget query
        const promises = widget.queries.map(async query => {
          const {start, end, period} = selection.datetime;
          const params: Record<string, any> = {
            project: selection.projects,
            environment: selection.environments,
            start: start ? new Date(start).toISOString() : undefined,
            end: end ? new Date(end).toISOString() : undefined,
            statsPeriod: period || (!start && !end ? '14d' : undefined),
            interval: widget.interval || '1d',
            field: query.aggregates[0] || 'max(max_install_size)',
          };

          // Parse conditions string into separate filter parameters
          // Old format: "app_id:com.example.app artifact_type:0 git_head_ref:main"
          // New format: separate query params
          if (query.conditions) {
            const tokens = query.conditions.split(' ');
            tokens.forEach(token => {
              if (token.includes(':')) {
                const [key, value] = token.split(':', 2);
                params[key] = value;
              }
            });
          }

          const response = await api.requestPromise(
            `/organizations/${organization.slug}/preprod/app-size-stats/`,
            {
              method: 'GET',
              query: params,
            }
          );

          return {query, response: response as AppSizeResponse};
        });

        const results = await Promise.all(promises);

        if (isTableDisplay) {
          // Transform to table format
          const tableData: TableDataWithTitle[] = results.map(({query, response}) => {
            const aggregate = query.aggregates[0] || 'value';
            const data = response.data.map(([timestamp, values], idx) => ({
              id: String(idx),
              timestamp,
              [aggregate]: values[0]?.count ?? 0,
            }));

            return {
              title: query.name,
              data,
              meta: response.meta,
            };
          });

          setTableResults(tableData);
          onDataFetched?.({tableResults: tableData});
        } else {
          // Transform to timeseries format
          const series: Series[] = results.map(({query, response}) => {
            // Filter out time buckets with no data, then map to series format
            // This creates a continuous line connecting only the actual data points
            const seriesData = response.data
              .filter(([, values]) => values[0]?.count != null)
              .map(([timestamp, values]) => ({
                name: timestamp * 1000, // Convert to milliseconds
                value: values[0]!.count as number,
              }));

            return {
              seriesName: query.name || query.aggregates[0] || 'value',
              data: seriesData,
            };
          });

          const types: Record<string, AggregationOutputType> = {};
          results.forEach(({query}) => {
            const aggregate = query.aggregates[0];
            if (aggregate) {
              types[aggregate] = 'size';
            }
          });

          setTimeseriesResults(series);
          setTimeseriesResultsTypes(types);
          onDataFetched?.({
            timeseriesResults: series,
            timeseriesResultsTypes: types,
          });
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to fetch app size data'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, organization.slug, serializedSelection, serializedQueries, widget.interval]);

  return getDynamicText({
    value: (
      <Fragment>
        {children({
          loading,
          errorMessage,
          timeseriesResults,
          tableResults,
          timeseriesResultsTypes,
        })}
      </Fragment>
    ),
    fixed: <div />,
  });
}

export default PreprodWidgetQueries;
