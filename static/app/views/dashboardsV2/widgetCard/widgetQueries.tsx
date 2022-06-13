import {Component} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {Client} from 'sentry/api';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import {
  EventsStats,
  MultiSeriesEventsStats,
  OrganizationSummary,
  PageFilters,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';

import {getDatasetConfig} from '../datasetConfig/base';
import {DisplayType, Widget, WidgetQuery, WidgetType} from '../types';

import {DashboardsMEPContext} from './dashboardsMEPContext';

type RawResult = EventsStats | MultiSeriesEventsStats;

type SeriesWithOrdering = [order: number, series: Series];

function transformSeries(stats: EventsStats, seriesName: string): Series {
  return {
    seriesName,
    data:
      stats?.data?.map(([timestamp, counts]) => ({
        name: timestamp * 1000,
        value: counts.reduce((acc, {count}) => acc + count, 0),
      })) ?? [],
  };
}

/**
 * Multiseries data with a grouping needs to be "flattened" because the aggregate data
 * are stored under the group names. These names need to be combined with the aggregate
 * names to show a series.
 *
 * e.g. count() and count_unique() grouped by environment
 * {
 *    "local": {
 *      "count()": {...},
 *      "count_unique()": {...}
 *    },
 *    "prod": {
 *      "count()": {...},
 *      "count_unique()": {...}
 *    }
 * }
 */
export function flattenMultiSeriesDataWithGrouping(
  result: RawResult,
  queryAlias: string
): SeriesWithOrdering[] {
  const seriesWithOrdering: SeriesWithOrdering[] = [];
  const groupNames = Object.keys(result);

  groupNames.forEach(groupName => {
    // Each group contains an order key which we should ignore
    const aggregateNames = Object.keys(omit(result[groupName], 'order'));

    aggregateNames.forEach(aggregate => {
      const seriesName = `${groupName} : ${aggregate}`;
      const prefixedName = queryAlias ? `${queryAlias} > ${seriesName}` : seriesName;
      const seriesData: EventsStats = result[groupName][aggregate];

      seriesWithOrdering.push([
        result[groupName].order || 0,
        transformSeries(seriesData, prefixedName),
      ]);
    });
  });

  return seriesWithOrdering;
}

function getIsMetricsDataFromSeriesResponse(result: RawResult): boolean | undefined {
  const multiIsMetricsData = Object.values(result)
    .map(({isMetricsData}) => isMetricsData)
    // One non-metrics series will cause all of them to be marked as such
    .reduce((acc, value) => (acc === false ? false : value), undefined);

  return isMultiSeriesStats(result) ? multiIsMetricsData : result.isMetricsData;
}

function transformResult(
  query: WidgetQuery,
  result: RawResult,
  displayType: DisplayType,
  widgetBuilderNewDesign: boolean = false
): Series[] {
  let output: Series[] = [];

  const queryAlias = query.name;

  if (isMultiSeriesStats(result)) {
    let seriesWithOrdering: SeriesWithOrdering[] = [];
    const isMultiSeriesDataWithGrouping =
      query.aggregates.length > 1 && query.columns.length;

    // Convert multi-series results into chartable series. Multi series results
    // are created when multiple yAxis are used. Convert the timeseries
    // data into a multi-series result set.  As the server will have
    // replied with a map like: {[titleString: string]: EventsStats}
    if (
      widgetBuilderNewDesign &&
      displayType !== DisplayType.TOP_N &&
      isMultiSeriesDataWithGrouping
    ) {
      seriesWithOrdering = flattenMultiSeriesDataWithGrouping(result, queryAlias);
    } else {
      seriesWithOrdering = Object.keys(result).map((seriesName: string) => {
        const prefixedName = queryAlias ? `${queryAlias} : ${seriesName}` : seriesName;
        const seriesData: EventsStats = result[seriesName];
        return [seriesData.order || 0, transformSeries(seriesData, prefixedName)];
      });
    }

    output = [
      ...seriesWithOrdering
        .sort((itemA, itemB) => itemA[0] - itemB[0])
        .map(item => item[1]),
    ];
  } else {
    const field = query.aggregates[0];
    const prefixedName = queryAlias ? `${queryAlias} : ${field}` : field;
    const transformed = transformSeries(result, prefixedName);
    output.push(transformed);
  }

  return output;
}

type Props = {
  api: Client;
  children: (
    props: Pick<
      State,
      'loading' | 'timeseriesResults' | 'tableResults' | 'errorMessage' | 'pageLinks'
    >
  ) => React.ReactNode;
  organization: OrganizationSummary;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  limit?: number;
  onDataFetched?: (results: {
    pageLinks?: string;
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
  }) => void;
};

type State = {
  loading: boolean;
  errorMessage?: string;
  pageLinks?: null | string;
  queryFetchID?: symbol;
  rawResults?: RawResult[];
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
};

class WidgetQueries extends Component<Props, State> {
  state: State = {
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

  componentDidUpdate(prevProps: Props) {
    const {selection, widget, cursor, organization} = this.props;
    const widgetBuilderNewDesign = organization.features.includes(
      'new-widget-builder-experience-design'
    );

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
            transformResult(
              query,
              prevState.rawResults![index],
              widget.displayType,
              widgetBuilderNewDesign
            )
          );
        }, []);

        return {...prevState, timeseriesResults};
      });
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  static contextType = DashboardsMEPContext;
  context: React.ContextType<typeof DashboardsMEPContext> | undefined;
  config = getDatasetConfig(WidgetType.DISCOVER);

  private _isMounted: boolean = false;

  async fetchTimeseriesData(queryFetchID: symbol) {
    const {selection, api, organization, widget, onDataFetched} = this.props;
    const widgetBuilderNewDesign = organization.features.includes(
      'new-widget-builder-experience-design'
    );
    this.setState({timeseriesResults: [], rawResults: []});

    const requests = this.config.getTimeseriesRequests!(widget, {
      organization,
      pageFilters: selection,
      api,
    });

    let isMetricsData: boolean | undefined;
    for (const [i, request] of requests.entries()) {
      const rawResults = await request;
      console.log(rawResults);
      if (!this._isMounted) {
        return;
      }
      // If one of the queries is sampled, then mark the whole thing as sampled
      isMetricsData =
        isMetricsData === false ? false : getIsMetricsDataFromSeriesResponse(rawResults);
      this.setState(prevState => {
        if (prevState.queryFetchID !== queryFetchID) {
          // invariant: a different request was initiated after this request
          return prevState;
        }

        const timeseriesResults = [...(prevState.timeseriesResults ?? [])];
        const transformedResult = transformResult(
          widget.queries[i],
          rawResults,
          widget.displayType,
          widgetBuilderNewDesign
        );
        // When charting timeseriesData on echarts, color association to a timeseries result
        // is order sensitive, ie series at index i on the timeseries array will use color at
        // index i on the color array. This means that on multi series results, we need to make
        // sure that the order of series in our results do not change between fetches to avoid
        // coloring inconsistencies between renders.
        transformedResult.forEach((result, resultIndex) => {
          timeseriesResults[i * transformedResult.length + resultIndex] = result;
        });

        const rawResultsClone = cloneDeep(prevState.rawResults ?? []);
        rawResultsClone[i] = rawResults;

        onDataFetched?.({timeseriesResults});

        return {
          ...prevState,
          timeseriesResults,
          rawResults: rawResultsClone,
        };
      });
    }
  }

  processTableResponse(responses) {
    const {widget, organization} = this.props;
    let pageLinks: string | null = null;
    let isMetricsData: boolean | undefined;
    const tableResults = responses.map(([data, _textcode, resp], i) => {
      // If one of the queries is sampled, then mark the whole thing as sampled
      isMetricsData = isMetricsData === false ? false : data.meta?.isMetricsData;

      // Cast so we can add the title.
      const tableData = this.config.transformTable(data, widget.queries[0], {
        organization,
      }) as TableDataWithTitle;
      tableData.title = widget.queries[i]?.name ?? '';
      pageLinks = resp?.getResponseHeader('Link');

      return tableData;
    });

    return {pageLinks: pageLinks ?? undefined, tableResults, isMetricsData};
  }

  processTimeseriesResponse(responses) {
    let isMetricsData: boolean | undefined;
    return {timeseriesResults, rawResults, isMetricsData};
  }

  async fetchData() {
    const {selection, api, organization, widget, limit, cursor, onDataFetched} =
      this.props;

    this.setState({
      loading: true,
      errorMessage: undefined,
      tableResults: [],
      timeseriesResults: [],
      rawResults: [],
    });

    let requests;
    let responseProcessor;
    let isMetricsData;
    try {
      if (['table', 'world_map', 'big_number'].includes(widget.displayType)) {
        requests = this.config.getTableRequests!(
          widget,
          {
            organization,
            pageFilters: selection,
            api,
          },
          limit,
          cursor
        );
        responseProcessor = this.processTableResponse.bind(this);
      } else {
        // this.fetchTimeseriesData(Symbol('bleh'));
        requests = this.config.getTimeseriesRequests!(widget, {
          organization,
          pageFilters: selection,
          api,
        });
        responseProcessor = () => {};
        return;
      }

      const responses = await Promise.all(requests);
      const processedData = responseProcessor(responses);

      onDataFetched?.({...processedData});

      this.setState({
        ...processedData,
        // tableResults,
        // pageLinks,
      });
    } catch (err) {
      const errorMessage = err?.responseJSON?.detail || t('An unknown error occurred.');
      this.setState({errorMessage});
    } finally {
      if (!this._isMounted) {
        return;
      }
      this.context?.setIsMetricsData(isMetricsData);
      this.setState({
        loading: false,
      });
    }
  }

  render() {
    const {children} = this.props;
    const {loading, timeseriesResults, tableResults, errorMessage, pageLinks} =
      this.state;

    const filteredTimeseriesResults = timeseriesResults?.filter(result => !!result);
    return children({
      loading,
      timeseriesResults: filteredTimeseriesResults,
      tableResults,
      errorMessage,
      pageLinks,
    });
  }
}

export default WidgetQueries;
