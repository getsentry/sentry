import {useCallback, useEffect, useRef, useState} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import type {Client, ResponseMeta} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Confidence, Organization} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import type {DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {DashboardFilters, Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {DEFAULT_TABLE_LIMIT, DisplayType} from 'sentry/views/dashboards/types';
import {
  dashboardFiltersToString,
  isChartDisplayType,
} from 'sentry/views/dashboards/utils';
import type {WidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';

export function getReferrer(displayType: DisplayType) {
  let referrer = '';

  if (displayType === DisplayType.TABLE) {
    referrer = 'api.dashboards.tablewidget';
  } else if (displayType === DisplayType.BIG_NUMBER) {
    referrer = 'api.dashboards.bignumberwidget';
  } else {
    referrer = `api.dashboards.widget.${displayType}-chart`;
  }

  return referrer;
}

export type OnDataFetchedProps = {
  confidence?: Confidence;
  isProgressivelyLoading?: boolean;
  isSampled?: boolean | null;
  pageLinks?: string;
  sampleCount?: number;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  timeseriesResultsUnits?: Record<string, DataUnit>;
  totalIssuesCount?: string;
};

export type GenericWidgetQueriesChildrenProps = {
  loading: boolean;
  confidence?: Confidence;
  errorMessage?: string;
  isProgressivelyLoading?: boolean;
  isSampled?: boolean | null;
  pageLinks?: string;
  sampleCount?: number;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  timeseriesResultsUnits?: Record<string, DataUnit>;
  totalCount?: string;
};

export type GenericWidgetQueriesProps<SeriesResponse, TableResponse> = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => React.ReactNode;
  config: DatasetConfig<SeriesResponse, TableResponse>;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  afterFetchSeriesData?: (result: SeriesResponse) => void;
  afterFetchTableData?: (
    result: TableResponse,
    response?: ResponseMeta
  ) => void | {totalIssuesCount?: string};
  cursor?: string;
  customDidUpdateComparator?: (
    prevProps: GenericWidgetQueriesProps<SeriesResponse, TableResponse>,
    nextProps: GenericWidgetQueriesProps<SeriesResponse, TableResponse>
  ) => boolean;
  dashboardFilters?: DashboardFilters;
  disabled?: boolean;
  forceOnDemand?: boolean;
  limit?: number;
  loading?: boolean;
  mepSetting?: MEPState | null;
  onDataFetchStart?: () => void;
  onDataFetched?: ({
    tableResults,
    timeseriesResults,
    totalIssuesCount,
    pageLinks,
    timeseriesResultsTypes,
  }: OnDataFetchedProps) => void;
  onDemandControlContext?: OnDemandControlContext;
  queue?: WidgetQueryQueue;
  samplingMode?: SamplingMode;
  // Skips adding parens before applying dashboard filters
  // Used for datasets that do not support parens/boolean logic
  skipDashboardFilterParens?: boolean;
};

function GenericWidgetQueries<SeriesResponse, TableResponse>(
  props: GenericWidgetQueriesProps<SeriesResponse, TableResponse>
) {
  const {
    api,
    children,
    config,
    organization,
    selection,
    widget,
    afterFetchSeriesData,
    afterFetchTableData,
    cursor,
    customDidUpdateComparator,
    dashboardFilters,
    disabled,
    forceOnDemand,
    limit,
    loading: propsLoading,
    mepSetting,
    onDataFetchStart,
    onDataFetched,
    onDemandControlContext,
    queue,
    samplingMode,
    skipDashboardFilterParens,
  } = props;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [timeseriesResults, setTimeseriesResults] = useState<Series[] | undefined>(
    undefined
  );
  const [rawResults, setRawResults] = useState<SeriesResponse[] | undefined>(undefined);
  const [tableResults, setTableResults] = useState<TableDataWithTitle[] | undefined>(
    undefined
  );
  const [pageLinks, setPageLinks] = useState<string | undefined>(undefined);
  const [timeseriesResultsTypes, setTimeseriesResultsTypes] = useState<
    Record<string, AggregationOutputType> | undefined
  >(undefined);
  const [timeseriesResultsUnits, setTimeseriesResultsUnits] = useState<
    Record<string, DataUnit> | undefined
  >(undefined);

  const isMountedRef = useRef(false);
  const queryFetchIDRef = useRef<symbol | undefined>(undefined);
  const prevPropsRef = useRef<
    GenericWidgetQueriesProps<SeriesResponse, TableResponse> | undefined
  >(undefined);
  const rawResultsRef = useRef<SeriesResponse[] | undefined>(undefined);
  const hasInitialFetchRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    rawResultsRef.current = rawResults;
  }, [rawResults]);

  const applyDashboardFilters = useCallback(
    (widgetToFilter: Widget): Widget => {
      const dashboardFilterConditions = dashboardFiltersToString(
        dashboardFilters,
        widgetToFilter.widgetType
      );
      widgetToFilter.queries.forEach(query => {
        if (dashboardFilterConditions) {
          // If there is no base query, there's no need to add parens
          if (query.conditions && !skipDashboardFilterParens) {
            query.conditions = `(${query.conditions})`;
          }
          query.conditions = query.conditions + ` ${dashboardFilterConditions}`;
        }
      });
      return widgetToFilter;
    },
    [dashboardFilters, skipDashboardFilterParens]
  );

  const widgetForRequest = useCallback(
    (widgetToProcess: Widget): Widget => {
      const processedWidget = applyDashboardFilters(widgetToProcess);
      return cleanWidgetForRequest(processedWidget);
    },
    [applyDashboardFilters]
  );

  const fetchTableData = useCallback(
    async (fetchID: symbol) => {
      if (disabled) {
        return;
      }
      const originalWidget = widget;
      const widgetToFetch = widgetForRequest(cloneDeep(originalWidget));
      const responses = await Promise.all(
        widgetToFetch.queries.map(query => {
          const requestLimit: number | undefined = limit ?? DEFAULT_TABLE_LIMIT;
          const requestCreator = config.getTableRequest;

          if (!requestCreator) {
            throw new Error(
              t('This display type is not supported by the selected dataset.')
            );
          }

          return requestCreator(
            api,
            widgetToFetch,
            query,
            organization,
            selection,
            onDemandControlContext,
            requestLimit,
            cursor,
            getReferrer(widgetToFetch.displayType),
            mepSetting,
            samplingMode
          );
        })
      );

      let transformedTableResults: TableDataWithTitle[] = [];
      let responsePageLinks: string | undefined;
      let afterTableFetchData: OnDataFetchedProps | undefined;
      responses.forEach(([data, _textstatus, resp], i) => {
        afterTableFetchData = afterFetchTableData?.(data, resp) ?? {};
        // Cast so we can add the title.
        const transformedData = config.transformTable(
          data,
          widgetToFetch.queries[0]!,
          organization,
          selection
        ) as TableDataWithTitle;
        transformedData.title = widgetToFetch.queries[i]?.name ?? '';

        const meta = transformedData.meta;
        const fieldMeta = widgetToFetch?.queries?.[i]?.fieldMeta;
        if (fieldMeta && meta) {
          fieldMeta.forEach((m, index) => {
            const field = widgetToFetch.queries?.[i]?.fields?.[index];
            if (m && field) {
              meta.units![field] = m.valueUnit ?? '';
              meta.fields![field] = m.valueType;
            }
          });
        }

        // Overwrite the local var to work around state being stale in tests.
        transformedTableResults = [...transformedTableResults, transformedData];

        // There is some inconsistency with the capitalization of "link" in response headers
        responsePageLinks =
          (resp?.getResponseHeader('Link') || resp?.getResponseHeader('link')) ??
          undefined;
      });

      if (isMountedRef.current && queryFetchIDRef.current === fetchID) {
        onDataFetched?.({
          tableResults: transformedTableResults,
          pageLinks: responsePageLinks,
          ...afterTableFetchData,
        });
        setTableResults(transformedTableResults);
        setPageLinks(responsePageLinks);
      }
    },
    [
      disabled,
      widget,
      widgetForRequest,
      limit,
      config,
      api,
      organization,
      selection,
      onDemandControlContext,
      cursor,
      mepSetting,
      samplingMode,
      afterFetchTableData,
      onDataFetched,
    ]
  );

  const fetchSeriesData = useCallback(
    async (fetchID: symbol) => {
      if (disabled) {
        return;
      }

      const originalWidget = widget;
      const widgetToFetch = widgetForRequest(cloneDeep(originalWidget));

      const responses = await Promise.all(
        widgetToFetch.queries.map((_query, index) => {
          return config.getSeriesRequest!(
            api,
            widgetToFetch,
            index,
            organization,
            selection,
            onDemandControlContext,
            getReferrer(widgetToFetch.displayType),
            mepSetting,
            samplingMode
          );
        })
      );
      const rawResultsClone = cloneDeep(rawResultsRef.current) ?? [];
      const transformedTimeseriesResults: Series[] = []; // Watch out, this is a sparse array. `map` and `forEach` will skip the empty slots. Spreading the array with `...` will create an `undefined` for each slot.
      responses.forEach(([data], requestIndex) => {
        afterFetchSeriesData?.(data);
        rawResultsClone[requestIndex] = data;
        const transformedResult = config.transformSeries!(
          data,
          widgetToFetch.queries[requestIndex]!,
          organization
        );
        // When charting timeseriesData on echarts, color association to a timeseries result
        // is order sensitive, ie series at index i on the timeseries array will use color at
        // index i on the color array. This means that on multi series results, we need to make
        // sure that the order of series in our results do not change between fetches to avoid
        // coloring inconsistencies between renders.
        transformedResult.forEach((result, resultIndex) => {
          transformedTimeseriesResults[
            requestIndex * transformedResult.length + resultIndex
          ] = result;
        });
      });

      // Retrieve the config's series result types and units
      // Since each query only differs in its query filter, we can use the first widget queries
      // to derive the types and units since they share the same aggregations and fields
      const newTimeseriesResultsTypes = responses.reduce(
        (acc, response) => {
          let allResultTypes: Record<string, AggregationOutputType> = {};
          widgetToFetch.queries.forEach(query => {
            allResultTypes = {
              ...allResultTypes,
              ...config.getSeriesResultType?.(response[0], query),
            };
          });
          acc = {...acc, ...allResultTypes};
          return acc;
        },
        {} as Record<string, AggregationOutputType>
      );
      const newTimeseriesResultsUnits = responses.reduce(
        (acc, response) => {
          let allResultUnits: Record<string, DataUnit> = {};
          widgetToFetch.queries.forEach(query => {
            allResultUnits = {
              ...allResultUnits,
              ...config.getSeriesResultUnit?.(response[0], query),
            };
          });
          acc = {...acc, ...allResultUnits};
          return acc;
        },
        {} as Record<string, DataUnit>
      );

      if (isMountedRef.current && queryFetchIDRef.current === fetchID) {
        onDataFetched?.({
          timeseriesResults: transformedTimeseriesResults,
          timeseriesResultsTypes: newTimeseriesResultsTypes,
          timeseriesResultsUnits: newTimeseriesResultsUnits,
        });
        setTimeseriesResults(transformedTimeseriesResults);
        setRawResults(rawResultsClone);
        setTimeseriesResultsTypes(newTimeseriesResultsTypes);
        setTimeseriesResultsUnits(newTimeseriesResultsUnits);
      }
    },
    [
      disabled,
      widget,
      widgetForRequest,
      config,
      api,
      organization,
      selection,
      onDemandControlContext,
      mepSetting,
      samplingMode,
      afterFetchSeriesData,
      onDataFetched,
    ]
  );

  const fetchData = useCallback(async () => {
    const fetchID = Symbol('queryFetchID');
    queryFetchIDRef.current = fetchID;
    setLoading(true);
    setTableResults(undefined);
    setTimeseriesResults(undefined);
    setErrorMessage(undefined);

    onDataFetchStart?.();

    try {
      if (isChartDisplayType(widget.displayType)) {
        await fetchSeriesData(fetchID);
      } else {
        await fetchTableData(fetchID);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setErrorMessage(
          err?.responseJSON?.detail || err?.message || t('An unknown error occurred.')
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [widget, onDataFetchStart, fetchSeriesData, fetchTableData]);

  const fetchDataWithQueueIfAvailable = useCallback(() => {
    if (queue) {
      queryFetchIDRef.current = undefined;
      setLoading(true);
      setTableResults(undefined);
      setTimeseriesResults(undefined);
      setErrorMessage(undefined);
      queue.addItem({widgetQuery: {fetchData}});
      return;
    }
    fetchData();
  }, [queue, fetchData]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!propsLoading && isMountedRef.current && !hasInitialFetchRef.current) {
      hasInitialFetchRef.current = true;
      prevPropsRef.current = props;
      fetchDataWithQueueIfAvailable();
    }
  }, [propsLoading, fetchDataWithQueueIfAvailable, props]);

  useEffect(() => {
    const prevProps = prevPropsRef.current;
    if (!prevProps) {
      prevPropsRef.current = props;
      return;
    }

    // We do not fetch data whenever the query name changes.
    // Also don't count empty fields when checking for field changes
    const previousQueries = prevProps.widget.queries;
    const [prevWidgetQueryNames, prevWidgetQueries] = previousQueries.reduce(
      (
        [names, queries]: [string[], Array<Omit<WidgetQuery, 'name'>>],
        {name, ...rest}
      ) => {
        names.push(name);
        rest.fields = rest.fields?.filter(field => !!field) ?? [];

        // Ignore aliases because changing alias does not need a query
        rest = omit(rest, 'fieldAliases');
        queries.push(rest);
        return [names, queries];
      },
      [[], []]
    );

    const nextQueries = widget.queries;
    const [widgetQueryNames, widgetQueries] = nextQueries.reduce(
      (
        [names, queries]: [string[], Array<Omit<WidgetQuery, 'name'>>],
        {name, ...rest}
      ) => {
        names.push(name);
        rest.fields = rest.fields?.filter(field => !!field) ?? [];

        // Ignore aliases because changing alias does not need a query
        rest = omit(rest, 'fieldAliases');
        queries.push(rest);
        return [names, queries];
      },
      [[], []]
    );

    if (
      customDidUpdateComparator
        ? customDidUpdateComparator(prevProps, props)
        : widget.limit !== prevProps.widget.limit ||
          !isEqual(widget.widgetType, prevProps.widget.widgetType) ||
          !isEqual(widget.displayType, prevProps.widget.displayType) ||
          !isEqual(widget.interval, prevProps.widget.interval) ||
          !isEqual(new Set(widgetQueries), new Set(prevWidgetQueries)) ||
          !isEqual(dashboardFilters, prevProps.dashboardFilters) ||
          !isEqual(forceOnDemand, prevProps.forceOnDemand) ||
          !isEqual(disabled, prevProps.disabled) ||
          !isSelectionEqual(selection, prevProps.selection) ||
          cursor !== prevProps.cursor
    ) {
      fetchDataWithQueueIfAvailable();
      prevPropsRef.current = props;
      return;
    }

    if (
      !loading &&
      !isEqual(prevWidgetQueryNames, widgetQueryNames) &&
      rawResults?.length === widget.queries.length
    ) {
      // If the query names has changed, then update timeseries labels
      const newTimeseriesResults = widget.queries.reduce(
        (acc: Series[], query, index) => {
          return acc.concat(
            config.transformSeries!(rawResults[index]!, query, organization)
          );
        },
        []
      );

      setTimeseriesResults(newTimeseriesResults);
    }

    prevPropsRef.current = props;
  }, [
    widget,
    selection,
    cursor,
    organization,
    config,
    customDidUpdateComparator,
    dashboardFilters,
    forceOnDemand,
    disabled,
    loading,
    rawResults,
    fetchDataWithQueueIfAvailable,
    props,
  ]);

  return children({
    loading,
    tableResults,
    timeseriesResults,
    errorMessage,
    pageLinks,
    timeseriesResultsTypes,
    timeseriesResultsUnits,
  });
}

export function cleanWidgetForRequest(widget: Widget): Widget {
  const _widget = cloneDeep(widget);
  _widget.queries.forEach(query => {
    query.aggregates = query.aggregates.filter(field => !!field && field !== 'equation|');
    query.columns = query.columns.filter(field => !!field && field !== 'equation|');
  });

  return _widget;
}

export default GenericWidgetQueries;
