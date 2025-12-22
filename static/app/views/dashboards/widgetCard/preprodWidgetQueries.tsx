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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      onDataFetchStart?.();
      setErrorMessage(undefined);

      try {
        const isTableDisplay = widget.displayType === DisplayType.TABLE;

        // Build query params for each widget query
        // If a query has multiple app_ids (comma-separated), create separate requests for each
        const promises = widget.queries.flatMap(query => {
          const {start, end, period} = selection.datetime;
          const baseParams: Record<string, any> = {
            project: selection.projects,
            environment: selection.environments,
            start: start ? new Date(start).toISOString() : undefined,
            end: end ? new Date(end).toISOString() : undefined,
            statsPeriod: period || (!start && !end ? '14d' : undefined),
            interval: widget.interval || '1d',
            field: query.aggregates[0] || 'max(max_install_size)',
          };

          // Parse conditions string into separate filter parameters
          // Format: "app_id:com.example.app1,com.example.app2 git_head_ref:main platform:iOS"
          let appIds: string[] = [];
          if (query.conditions) {
            const tokens = query.conditions.split(' ');
            tokens.forEach(token => {
              if (token.includes(':')) {
                const [key, value] = token.split(':', 2);
                if (key === 'app_id' && value) {
                  // Split comma-separated app_ids
                  appIds = value.split(',').filter(Boolean);
                } else if (value) {
                  // Add other filters to baseParams
                  baseParams[key] = value;
                }
              }
            });
          }

          // If no app_ids specified, make one request with no app_id filter
          if (appIds.length === 0) {
            return [
              api
                .requestPromise(
                  `/organizations/${organization.slug}/preprod/app-size-stats/`,
                  {
                    method: 'GET',
                    query: baseParams,
                  }
                )
                .then(response => ({
                  query,
                  response: response as AppSizeResponse,
                  appId: undefined,
                })),
            ];
          }

          // Create a separate request for each app_id
          return appIds.map(appId =>
            api
              .requestPromise(
                `/organizations/${organization.slug}/preprod/app-size-stats/`,
                {
                  method: 'GET',
                  query: {...baseParams, app_id: appId},
                }
              )
              .then(response => ({
                query,
                response: response as AppSizeResponse,
                appId,
              }))
          );
        });

        const results = await Promise.all(promises);

        if (isTableDisplay) {
          // Transform to table format
          const tableData: TableDataWithTitle[] = results.map(
            ({query, response, appId}) => {
              const aggregate = query.aggregates[0] || 'value';
              const data = response.data.map(([timestamp, values], idx) => ({
                id: String(idx),
                timestamp,
                [aggregate]: values[0]?.count ?? 0,
              }));

              // Use query name if provided, otherwise fallback to app_id
              let title = query.name || 'App Size';
              if (!query.name && appId) {
                title = appId;
              }

              return {
                title,
                data,
                meta: response.meta,
              };
            }
          );

          setTableResults(tableData);
          onDataFetched?.({tableResults: tableData});
        } else {
          // Transform to timeseries format
          const series: Series[] = results.map(({query, response, appId}) => {
            // Filter out time buckets with no data, then map to series format
            // This creates a continuous line connecting only the actual data points
            const seriesData = response.data
              .filter(([, values]) => values[0]?.count !== null)
              .map(([timestamp, values]) => ({
                name: timestamp * 1000, // Convert to milliseconds
                value: values[0]!.count as number,
              }));

            // Determine series name
            let seriesName: string;
            if (query.name) {
              // If query has a custom name, use it
              // If this query resulted in multiple series (multiple app_ids), append the app_id
              seriesName = appId ? `${query.name} (${appId})` : query.name;
            } else {
              // No custom name, just use app_id or fallback
              seriesName = appId || query.aggregates[0] || 'value';
            }

            return {
              seriesName,
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
