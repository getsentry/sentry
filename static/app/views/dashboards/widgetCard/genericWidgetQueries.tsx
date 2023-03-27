import {Component} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {Client, ResponseMeta} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import {Organization, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {AggregationOutputType} from 'sentry/utils/discover/fields';
import {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {dashboardFiltersToString} from 'sentry/views/dashboards/utils';

import {DatasetConfig} from '../datasetConfig/base';
import {
  DashboardFilters,
  DEFAULT_TABLE_LIMIT,
  DisplayType,
  Widget,
  WidgetQuery,
} from '../types';

function getReferrer(displayType: DisplayType) {
  let referrer: string = '';

  if (displayType === DisplayType.TABLE) {
    referrer = 'api.dashboards.tablewidget';
  } else if (displayType === DisplayType.BIG_NUMBER) {
    referrer = 'api.dashboards.bignumberwidget';
  } else if (displayType === DisplayType.WORLD_MAP) {
    referrer = 'api.dashboards.worldmapwidget';
  } else {
    referrer = `api.dashboards.widget.${displayType}-chart`;
  }

  return referrer;
}

export type OnDataFetchedProps = {
  pageLinks?: string;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  totalIssuesCount?: string;
};

export type GenericWidgetQueriesChildrenProps = {
  loading: boolean;
  errorMessage?: string;
  pageLinks?: string;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  totalCount?: string;
};

export type GenericWidgetQueriesProps<SeriesResponse, TableResponse> = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => JSX.Element;
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
  limit?: number;
  loading?: boolean;
  mepSetting?: MEPState | null;
  onDataFetched?: ({
    tableResults,
    timeseriesResults,
    totalIssuesCount,
    pageLinks,
    timeseriesResultsTypes,
  }: OnDataFetchedProps) => void;
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
      this.fetchData();
    }
  }

  componentDidUpdate(
    prevProps: GenericWidgetQueriesProps<SeriesResponse, TableResponse>
  ) {
    const {selection, widget, cursor, organization, config, customDidUpdateComparator} =
      this.props;

    // We do not fetch data whenever the query name changes.
    // Also don't count empty fields when checking for field changes
    const [prevWidgetQueryNames, prevWidgetQueries] = prevProps.widget.queries
      .map((query: WidgetQuery) => {
        query.aggregates = query.aggregates.filter(field => !!field);
        query.columns = query.columns.filter(field => !!field);
        return query;
      })
      .reduce(
        ([names, queries]: [string[], Omit<WidgetQuery, 'name'>[]], {name, ...rest}) => {
          names.push(name);
          rest.fields = rest.fields?.filter(field => !!field) ?? [];

          // Ignore aliases because changing alias does not need a query
          rest = omit(rest, 'fieldAliases');
          queries.push(rest);
          return [names, queries];
        },
        [[], []]
      );

    const [widgetQueryNames, widgetQueries] = widget.queries
      .map((query: WidgetQuery) => {
        query.aggregates = query.aggregates.filter(
          field => !!field && field !== 'equation|'
        );
        query.columns = query.columns.filter(field => !!field && field !== 'equation|');
        return query;
      })
      .reduce(
        ([names, queries]: [string[], Omit<WidgetQuery, 'name'>[]], {name, ...rest}) => {
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
          !isEqual(widget.displayType, prevProps.widget.displayType) ||
          !isEqual(widget.interval, prevProps.widget.interval) ||
          !isEqual(new Set(widgetQueries), new Set(prevWidgetQueries)) ||
          !isEqual(this.props.dashboardFilters, prevProps.dashboardFilters) ||
          !isSelectionEqual(selection, prevProps.selection) ||
          cursor !== prevProps.cursor
    ) {
      this.fetchData();
      return;
    }

    if (
      !this.state.loading &&
      !isEqual(prevWidgetQueryNames, widgetQueryNames) &&
      this.state.rawResults?.length === widget.queries.length
    ) {
      // If the query names has changed, then update timeseries labels

      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(prevState => {
        const timeseriesResults = widget.queries.reduce((acc: Series[], query, index) => {
          return acc.concat(
            config.transformSeries!(prevState.rawResults![index], query, organization)
          );
        }, []);

        return {...prevState, timeseriesResults};
      });
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  private _isMounted: boolean = false;

  applyDashboardFilters(widget: Widget): Widget {
    const {dashboardFilters} = this.props;

    const dashboardFilterConditions = dashboardFiltersToString(dashboardFilters);
    widget.queries.forEach(query => {
      query.conditions =
        query.conditions +
        (dashboardFilterConditions === '' ? '' : ` ${dashboardFilterConditions}`);
    });

    return widget;
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
      mepSetting,
    } = this.props;
    const widget = this.applyDashboardFilters(cloneDeep(originalWidget));
    const responses = await Promise.all(
      widget.queries.map(query => {
        let requestLimit: number | undefined = limit ?? DEFAULT_TABLE_LIMIT;
        let requestCreator = config.getTableRequest;
        if (widget.displayType === DisplayType.WORLD_MAP) {
          requestLimit = undefined;
          requestCreator = config.getWorldMapRequest;
        }

        if (!requestCreator) {
          throw new Error(
            t('This display type is not supported by the selected dataset.')
          );
        }

        return requestCreator(
          api,
          query,
          organization,
          selection,
          requestLimit,
          cursor,
          getReferrer(widget.displayType),
          mepSetting
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
        widget.queries[0],
        organization,
        selection
      ) as TableDataWithTitle;
      transformedData.title = widget.queries[i]?.name ?? '';

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
    } = this.props;
    const widget = this.applyDashboardFilters(cloneDeep(originalWidget));

    const responses = await Promise.all(
      widget.queries.map((_query, index) => {
        return config.getSeriesRequest!(
          api,
          widget,
          index,
          organization,
          selection,
          getReferrer(widget.displayType),
          mepSetting
        );
      })
    );
    const rawResultsClone = cloneDeep(this.state.rawResults) ?? [];
    const transformedTimeseriesResults: Series[] = [];
    responses.forEach(([data], requestIndex) => {
      afterFetchSeriesData?.(data);
      rawResultsClone[requestIndex] = data;
      const transformedResult = config.transformSeries!(
        data,
        widget.queries[requestIndex],
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

    // Get series result type
    // Only used by custom measurements in errorsAndTransactions at the moment
    const timeseriesResultsTypes = config.getSeriesResultType?.(
      responses[0][0],
      widget.queries[0]
    );

    if (this._isMounted && this.state.queryFetchID === queryFetchID) {
      onDataFetched?.({
        timeseriesResults: transformedTimeseriesResults,
        timeseriesResultsTypes,
      });
      this.setState({
        timeseriesResults: transformedTimeseriesResults,
        rawResults: rawResultsClone,
        timeseriesResultsTypes,
      });
    }
  }

  async fetchData() {
    const {widget} = this.props;

    const queryFetchID = Symbol('queryFetchID');
    this.setState({
      loading: true,
      tableResults: undefined,
      timeseriesResults: undefined,
      errorMessage: undefined,
      queryFetchID,
    });

    try {
      if (
        [DisplayType.TABLE, DisplayType.BIG_NUMBER, DisplayType.WORLD_MAP].includes(
          widget.displayType
        )
      ) {
        await this.fetchTableData(queryFetchID);
      } else {
        await this.fetchSeriesData(queryFetchID);
      }
    } catch (err) {
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
    } = this.state;

    return children({
      loading,
      tableResults,
      timeseriesResults,
      errorMessage,
      pageLinks,
      timeseriesResultsTypes,
    });
  }
}

export default GenericWidgetQueries;
