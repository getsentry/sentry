import {Component} from 'react';
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
import {Widget, WidgetQuery, WidgetType} from '../types';

import {DashboardsMEPContext} from './dashboardsMEPContext';

type RawResult = EventsStats | MultiSeriesEventsStats;

type SeriesWithOrdering = [order: number, series: Series];

export function transformSeries(stats: EventsStats, seriesName: string): Series {
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
            this.config.transformSeries!(prevState.rawResults![index], query, {
              organization,
            })
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

  processTableResponse = responses => {
    const {widget, organization} = this.props;
    let pageLinks: string | null = null;
    let isMetricsData: boolean | undefined;
    const tableResults = responses.map(([data, _textstatus, resp], i) => {
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
  };

  processTimeseriesResponse = (responses: RawResult[]) => {
    const {organization, widget} = this.props;

    let isMetricsData: boolean | undefined;
    const rawResults: RawResult[] = [];
    const timeseriesResults: Series[] = [];
    responses.forEach((rawResult, i) => {
      if (!this._isMounted) {
        return;
      }
      // If one of the queries is sampled, then mark the whole thing as sampled
      isMetricsData =
        isMetricsData === false ? false : getIsMetricsDataFromSeriesResponse(rawResult);

      const transformedResult = this.config.transformSeries!(
        rawResult,
        widget.queries[i],
        {organization}
      );
      // When charting timeseriesData on echarts, color association to a timeseries result
      // is order sensitive, ie series at index i on the timeseries array will use color at
      // index i on the color array. This means that on multi series results, we need to make
      // sure that the order of series in our results do not change between fetches to avoid
      // coloring inconsistencies between renders.
      transformedResult.forEach((result, resultIndex) => {
        timeseriesResults[i * transformedResult.length + resultIndex] = result;
      });

      rawResults[i] = rawResult;
    });
    return {timeseriesResults, rawResults, isMetricsData};
  };

  async fetchData() {
    const {selection, api, organization, widget, limit, cursor, onDataFetched} =
      this.props;

    this.setState({
      loading: true,
      errorMessage: undefined,
    });

    let requests: ReturnType<Client['requestPromise']>[];
    let responseProcessor:
      | typeof this.processTableResponse
      | typeof this.processTimeseriesResponse;
    let isMetricsData: boolean | undefined;
    const contextualRequestProps = {
      organization,
      pageFilters: selection,
      api,
    };
    try {
      if (['table', 'world_map', 'big_number'].includes(widget.displayType)) {
        requests = this.config.getTableRequests!(
          widget,
          contextualRequestProps,
          limit,
          cursor
        );
        responseProcessor = this.processTableResponse;
      } else {
        requests = this.config.getTimeseriesRequests!(widget, contextualRequestProps);
        responseProcessor = this.processTimeseriesResponse;
      }

      const responses = await Promise.all(requests);
      const processedData = responseProcessor(responses);

      isMetricsData = processedData.isMetricsData;

      if (!this._isMounted) {
        return;
      }

      onDataFetched?.({...processedData});
      this.setState({
        loading: false,
        ...processedData,
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
