import {Component} from 'react';
import isEqual from 'lodash/isEqual';

import {Client, ResponseMeta} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import {Organization, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';

import {DatasetConfig} from '../datasetConfig/base';
import {DEFAULT_TABLE_LIMIT, DisplayType, Widget, WidgetQuery} from '../types';

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

export type GenericWidgetQueriesChildrenProps = {
  loading: boolean;
  errorMessage?: string;
  pageLinks?: null | string;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  totalCount?: string;
};

export type GenericWidgetQueriesProps<SeriesResponse, TableResponse> = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => JSX.Element;
  config: DatasetConfig<SeriesResponse, TableResponse>;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  limit?: number;
  onDataFetched?: ({
    tableResults,
    timeseriesResults,
    totalIssuesCount,
    pageLinks,
  }: {
    pageLinks?: string;
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
    totalIssuesCount?: string;
  }) => void;
  processRawSeriesResult?: (result: SeriesResponse) => void;
  processRawTableResult?: (
    result: TableResponse,
    response?: ResponseMeta
  ) => void | {totalIssuesCount?: string};
};

type State<SeriesResponse> = {
  loading: boolean;
  errorMessage?: GenericWidgetQueriesChildrenProps['errorMessage'];
  pageLinks?: GenericWidgetQueriesChildrenProps['pageLinks'];
  queryFetchID?: symbol;
  rawResults?: SeriesResponse[];
  tableResults?: GenericWidgetQueriesChildrenProps['tableResults'];
  timeseriesResults?: GenericWidgetQueriesChildrenProps['timeseriesResults'];
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
  };

  componentDidMount() {
    this._isMounted = true;
    this.fetchData();
  }

  componentDidUpdate(
    prevProps: GenericWidgetQueriesProps<SeriesResponse, TableResponse>
  ) {
    const {selection, widget, cursor, organization, config} = this.props;

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
          queries.push(rest);
          return [names, queries];
        },
        [[], []]
      );

    if (
      widget.limit !== prevProps.widget.limit ||
      !isEqual(widget.displayType, prevProps.widget.displayType) ||
      !isEqual(widget.interval, prevProps.widget.interval) ||
      !isEqual(widgetQueries, prevWidgetQueries) ||
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

  async fetchTableData(queryFetchID: symbol) {
    const {
      widget,
      limit,
      config,
      api,
      organization,
      selection,
      cursor,
      processRawTableResult,
      onDataFetched,
    } = this.props;
    const responses = await Promise.all<[TableResponse, string, ResponseMeta]>(
      widget.queries.map(query => {
        let requestLimit: number | undefined = limit ?? DEFAULT_TABLE_LIMIT;
        let requestCreator = config.getTableRequest;
        if (widget.displayType === DisplayType.WORLD_MAP) {
          requestLimit = undefined;
          requestCreator = config.getWorldMapRequest;
        }
        return requestCreator!(
          api,
          query,
          organization,
          selection,
          requestLimit,
          cursor,
          getReferrer(widget.displayType)
        );
      })
    );

    // transform the data
    let transformedTableResults: TableDataWithTitle[] = [];
    let responsePageLinks: string | null = null;
    let processedData: {totalIssuesCount?: string} | undefined;
    responses.forEach(([data, _textstatus, resp], i) => {
      processedData = processRawTableResult?.(data, resp) ?? {};
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
      responsePageLinks = resp?.getResponseHeader('Link');
    });

    if (this._isMounted && this.state.queryFetchID === queryFetchID) {
      onDataFetched?.({
        tableResults: transformedTableResults,
        pageLinks: responsePageLinks ?? undefined,
        ...processedData,
      });
      this.setState({
        tableResults: transformedTableResults,
        pageLinks: responsePageLinks,
      });
    }
  }

  async fetchSeriesData(queryFetchID: symbol) {
    const {
      widget,
      config,
      api,
      organization,
      selection,
      processRawSeriesResult,
      onDataFetched,
    } = this.props;
    const responses = await Promise.all<SeriesResponse>(
      widget.queries.map((_query, index) => {
        return config.getSeriesRequest!(
          api,
          widget,
          index,
          organization,
          selection,
          getReferrer(widget.displayType)
        );
      })
    );
    const transformedTimeseriesResults: Series[] = [];
    responses.forEach((rawResults, requestIndex) => {
      processRawSeriesResult?.(rawResults);
      const transformedResult = config.transformSeries!(
        rawResults,
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

    if (this._isMounted && this.state.queryFetchID === queryFetchID) {
      onDataFetched?.({timeseriesResults: transformedTimeseriesResults});
      this.setState({timeseriesResults: transformedTimeseriesResults});
    }
  }

  async fetchData() {
    const {widget} = this.props;

    const queryFetchID = Symbol('queryFetchID');
    this.setState({
      loading: true,
      tableResults: undefined,
      timeseriesResults: undefined,
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
          errorMessage: err?.responseJSON?.detail || t('An unknown error occurred.'),
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
    const {loading, tableResults, timeseriesResults, errorMessage, pageLinks} =
      this.state;

    return children({loading, tableResults, timeseriesResults, errorMessage, pageLinks});
  }
}

export default GenericWidgetQueries;
