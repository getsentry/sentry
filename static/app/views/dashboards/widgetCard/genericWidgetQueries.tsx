import {Component} from 'react';
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

type State<SeriesResponse> = {
  loading: boolean;
  errorMessage?: GenericWidgetQueriesChildrenProps['errorMessage'];
  pageLinks?: GenericWidgetQueriesChildrenProps['pageLinks'];
  queryFetchID?: symbol;
  rawResults?: SeriesResponse[];
  tableResults?: GenericWidgetQueriesChildrenProps['tableResults'];
  timeseriesResults?: GenericWidgetQueriesChildrenProps['timeseriesResults'];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  timeseriesResultsUnits?: Record<string, DataUnit>;
};

class GenericWidgetQueries<SeriesResponse, TableResponse> extends Component<
  GenericWidgetQueriesProps<SeriesResponse, TableResponse>,
  State<SeriesResponse>
> {
  state: State<SeriesResponse> = {
    loading: true,
    queryFetchID: undefined,
    errorMessage: undefined,
    timeseriesResults: undefined,
    rawResults: undefined,
    tableResults: undefined,
    pageLinks: undefined,
    timeseriesResultsTypes: undefined,
  };

  componentDidMount() {
    this._isMounted = true;
    if (!this.props.loading) {
      this.fetchDataWithQueueIfAvailable();
    }
  }

  componentDidUpdate(
    prevProps: GenericWidgetQueriesProps<SeriesResponse, TableResponse>
  ) {
    const {selection, widget, cursor, organization, config, customDidUpdateComparator} =
      this.props;

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
        ? customDidUpdateComparator(prevProps, this.props)
        : widget.limit !== prevProps.widget.limit ||
          !isEqual(widget.widgetType, prevProps.widget.widgetType) ||
          !isEqual(widget.displayType, prevProps.widget.displayType) ||
          !isEqual(widget.interval, prevProps.widget.interval) ||
          !isEqual(new Set(widgetQueries), new Set(prevWidgetQueries)) ||
          !isEqual(this.props.dashboardFilters, prevProps.dashboardFilters) ||
          !isEqual(this.props.forceOnDemand, prevProps.forceOnDemand) ||
          !isEqual(this.props.disabled, prevProps.disabled) ||
          !isSelectionEqual(selection, prevProps.selection) ||
          cursor !== prevProps.cursor
    ) {
      this.fetchDataWithQueueIfAvailable();
      return;
    }

    if (
      !this.state.loading &&
      !isEqual(prevWidgetQueryNames, widgetQueryNames) &&
      this.state.rawResults?.length === widget.queries.length
    ) {
      // If the query names has changed, then update timeseries labels

      this.setState(prevState => {
        const timeseriesResults = widget.queries.reduce((acc: Series[], query, index) => {
          return acc.concat(
            config.transformSeries!(prevState.rawResults![index]!, query, organization)
          );
        }, []);

        return {...prevState, timeseriesResults};
      });
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  private _isMounted = false;

  applyDashboardFilters(widget: Widget): Widget {
    const {dashboardFilters, skipDashboardFilterParens} = this.props;

    const dashboardFilterConditions = dashboardFiltersToString(
      dashboardFilters,
      widget.widgetType
    );
    widget.queries.forEach(query => {
      if (dashboardFilterConditions) {
        // If there is no base query, there's no need to add parens
        if (query.conditions && !skipDashboardFilterParens) {
          query.conditions = `(${query.conditions})`;
        }
        query.conditions = query.conditions + ` ${dashboardFilterConditions}`;
      }
    });
    return widget;
  }

  widgetForRequest(widget: Widget): Widget {
    widget = this.applyDashboardFilters(widget);
    return cleanWidgetForRequest(widget);
  }

  async fetchTableData(queryFetchID: symbol) {
    const {
      widget: originalWidget,
      limit,
      config,
      api,
      organization,
      selection,
      cursor,
      afterFetchTableData,
      onDataFetched,
      onDemandControlContext,
      mepSetting,
      samplingMode,
      disabled,
    } = this.props;
    if (disabled) {
      return;
    }
    const widget = this.widgetForRequest(cloneDeep(originalWidget));
    const responses = await Promise.all(
      widget.queries.map(query => {
        const requestLimit: number | undefined = limit ?? DEFAULT_TABLE_LIMIT;
        const requestCreator = config.getTableRequest;

        if (!requestCreator) {
          throw new Error(
            t('This display type is not supported by the selected dataset.')
          );
        }

        return requestCreator(
          api,
          widget,
          query,
          organization,
          selection,
          onDemandControlContext,
          requestLimit,
          cursor,
          getReferrer(widget.displayType),
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
        widget.queries[0]!,
        organization,
        selection
      ) as TableDataWithTitle;
      transformedData.title = widget.queries[i]?.name ?? '';

      const meta = transformedData.meta;
      const widgetUnits = widget?.queries?.[i]?.units;
      if (widgetUnits && meta) {
        widgetUnits.forEach((unit, index) => {
          const field = widget.queries?.[i]?.fields?.[index];
          if (unit && field) {
            meta.units![field] = unit.valueUnit ?? '';
            meta.fields![field] = unit.valueType;
          }
        });
      }

      // Overwrite the local var to work around state being stale in tests.
      transformedTableResults = [...transformedTableResults, transformedData];

      // There is some inconsistency with the capitalization of "link" in response headers
      responsePageLinks =
        (resp?.getResponseHeader('Link') || resp?.getResponseHeader('link')) ?? undefined;
    });

    if (this._isMounted && this.state.queryFetchID === queryFetchID) {
      onDataFetched?.({
        tableResults: transformedTableResults,
        pageLinks: responsePageLinks,
        ...afterTableFetchData,
      });
      this.setState({
        tableResults: transformedTableResults,
        pageLinks: responsePageLinks,
      });
    }
  }
  async fetchSeriesData(queryFetchID: symbol) {
    const {
      widget: originalWidget,
      config,
      api,
      organization,
      selection,
      afterFetchSeriesData,
      onDataFetched,
      mepSetting,
      onDemandControlContext,
      samplingMode,
      disabled,
    } = this.props;
    if (disabled) {
      return;
    }

    const widget = this.widgetForRequest(cloneDeep(originalWidget));

    const responses = await Promise.all(
      widget.queries.map((_query, index) => {
        return config.getSeriesRequest!(
          api,
          widget,
          index,
          organization,
          selection,
          onDemandControlContext,
          getReferrer(widget.displayType),
          mepSetting,
          samplingMode
        );
      })
    );
    const rawResultsClone = cloneDeep(this.state.rawResults) ?? [];
    const transformedTimeseriesResults: Series[] = []; // Watch out, this is a sparse array. `map` and `forEach` will skip the empty slots. Spreading the array with `...` will create an `undefined` for each slot.
    responses.forEach(([data], requestIndex) => {
      afterFetchSeriesData?.(data);
      rawResultsClone[requestIndex] = data;
      const transformedResult = config.transformSeries!(
        data,
        widget.queries[requestIndex]!,
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
    const timeseriesResultsTypes = responses.reduce(
      (acc, response) => {
        let allResultTypes: Record<string, AggregationOutputType> = {};
        widget.queries.forEach(query => {
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
    const timeseriesResultsUnits = responses.reduce(
      (acc, response) => {
        let allResultUnits: Record<string, DataUnit> = {};
        widget.queries.forEach(query => {
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

    if (this._isMounted && this.state.queryFetchID === queryFetchID) {
      onDataFetched?.({
        timeseriesResults: transformedTimeseriesResults,
        timeseriesResultsTypes,
        timeseriesResultsUnits,
      });
      this.setState({
        timeseriesResults: transformedTimeseriesResults,
        rawResults: rawResultsClone,
        timeseriesResultsTypes,
        timeseriesResultsUnits,
      });
    }
  }

  fetchDataWithQueueIfAvailable() {
    const {queue} = this.props;
    if (queue) {
      this.setState({
        loading: true,
        tableResults: undefined,
        timeseriesResults: undefined,
        errorMessage: undefined,
        queryFetchID: undefined,
      });
      queue.addItem({widgetQuery: this});
      return;
    }
    this.fetchData();
  }

  async fetchData() {
    const {widget, onDataFetchStart} = this.props;

    const queryFetchID = Symbol('queryFetchID');
    this.setState({
      loading: true,
      tableResults: undefined,
      timeseriesResults: undefined,
      errorMessage: undefined,
      queryFetchID,
    });

    onDataFetchStart?.();

    try {
      if (isChartDisplayType(widget.displayType)) {
        await this.fetchSeriesData(queryFetchID);
      } else {
        await this.fetchTableData(queryFetchID);
      }
    } catch (err: any) {
      if (this._isMounted) {
        this.setState({
          errorMessage:
            err?.responseJSON?.detail || err?.message || t('An unknown error occurred.'),
        });
      }
    } finally {
      if (this._isMounted) {
        this.setState({loading: false});
      }
    }
  }

  render() {
    const {children} = this.props;
    const {
      loading,
      tableResults,
      timeseriesResults,
      errorMessage,
      pageLinks,
      timeseriesResultsTypes,
      timeseriesResultsUnits,
    } = this.state;

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
