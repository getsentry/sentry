import * as React from 'react';
import isEqual from 'lodash/isEqual';
import omitBy from 'lodash/omitBy';

import {doEventsRequest} from 'sentry/actionCreators/events';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import {
  canIncludePreviousPeriod,
  getPreviousSeriesName,
  isMultiSeriesStats,
} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {
  DateString,
  EventsStats,
  EventsStatsData,
  MultiSeriesEventsStats,
  OrganizationSummary,
} from 'sentry/types';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {stripEquationPrefix} from 'sentry/utils/discover/fields';
import {QueryBatching} from 'sentry/utils/performance/contexts/genericQueryBatcher';

export type TimeSeriesData = {
  allTimeseriesData?: EventsStatsData;
  comparisonTimeseriesData?: Series[];
  originalPreviousTimeseriesData?: EventsStatsData | null;
  originalTimeseriesData?: EventsStatsData;
  previousTimeseriesData?: Series[] | null;
  timeAggregatedData?: Series | {};
  timeframe?: {end: number; start: number};
  // timeseries data
  timeseriesData?: Series[];
  timeseriesTotals?: {count: number};
};

type LoadingStatus = {
  /**
   * Whether there was an error retrieving data
   */
  errored: boolean;
  loading: boolean;
  reloading: boolean;
  errorMessage?: string;
};

export type RenderProps = LoadingStatus &
  TimeSeriesData & {
    results?: Series[]; // Chart with multiple series.
  };

type DefaultProps = {
  /**
   * Include data for previous period
   */
  includePrevious: boolean;
  /**
   * Transform the response data to be something ingestible by charts
   */
  includeTransformedData: boolean;
  /**
   * Interval to group results in
   *
   * e.g. 1d, 1h, 1m, 1s
   */
  interval: string;
  /**
   * number of rows to return
   */
  limit: number;
  /**
   * The query string to search events by
   */
  query: string;
  /**
   * Time delta for comparing intervals of alert metrics, in seconds
   */
  comparisonDelta?: number;
  /**
   * Absolute end date for query
   */
  end?: DateString;
  /**
   * Relative time period for query.
   *
   * Use `start` and `end` for absolute dates.
   *
   * e.g. 24h, 7d, 30d
   */
  period?: string | null;
  /**
   * Absolute start date for query
   */
  start?: DateString;
};

type EventsRequestPartialProps = {
  /**
   * API client instance
   */
  api: Client;
  children: (renderProps: RenderProps) => React.ReactNode;
  organization: OrganizationSummary;
  /**
   * Whether or not to include the last partial bucket. This happens for example when the
   * current time is 11:26 and the last bucket ranges from 11:25-11:30. This means that
   * the last bucket contains 1 minute worth of data while the rest contains 5 minutes.
   *
   * This flag indicates whether or not this last bucket should be included in the result.
   */
  partial: boolean;
  /**
   * Discover needs confirmation to run >30 day >10 project queries,
   * optional and when not passed confirmation is not required.
   */
  confirmedQuery?: boolean;
  /**
   * Name used for display current series data set tooltip
   */
  currentSeriesNames?: string[];
  /**
   * List of environments to query
   */
  environment?: Readonly<string[]>;
  /**
   * Is query out of retention
   */
  expired?: boolean;
  /**
   * List of fields to group with when doing a topEvents request.
   */
  field?: string[];
  /**
   * Allows overridding the pathname.
   */
  generatePathname?: (org: OrganizationSummary) => string;
  /**
   * Hide error toast (used for pages which also query eventsV2)
   */
  hideError?: boolean;
  /**
   * Initial loading state
   */
  loading?: boolean;
  /**
   * Query name used for displaying error toast if it is out of retention
   */
  name?: string;
  /**
   * How to order results when getting top events.
   */
  orderby?: string;
  previousSeriesNames?: string[];
  /**
   * List of project ids to query
   */
  project?: Readonly<number[]>;
  /**
   * A container for query batching data and functions.
   */
  queryBatching?: QueryBatching;
  /**
   * Extra query parameters to be added.
   */
  queryExtras?: Record<string, string>;
  /**
   * A unique name for what's triggering this request, see organization_events_stats for an allowlist
   */
  referrer?: string;
  /**
   * Should loading be shown.
   */
  showLoading?: boolean;
  /**
   * List of team ids to query
   */
  team?: Readonly<string | string[]>;
  /**
   * The number of top results to get. When set a multi-series result will be returned
   * in the `results` child render function.
   */
  topEvents?: number;
  /**
   * Whether or not to zerofill results
   */
  withoutZerofill?: boolean;
  /**
   * The yAxis being plotted. If multiple yAxis are requested,
   * the child render function will be called with `results`
   */
  yAxis?: string | string[];
};

type TimeAggregationProps =
  | {includeTimeAggregation: true; timeAggregationSeriesName: string}
  | {includeTimeAggregation?: false; timeAggregationSeriesName?: undefined};

export type EventsRequestProps = DefaultProps &
  TimeAggregationProps &
  EventsRequestPartialProps;

type EventsRequestState = {
  errored: boolean;
  fetchedWithPrevious: boolean;
  reloading: boolean;
  timeseriesData: null | EventsStats | MultiSeriesEventsStats;
  errorMessage?: string;
};

const propNamesToIgnore = [
  'api',
  'children',
  'organization',
  'loading',
  'queryBatching',
  'generatePathname',
];
const omitIgnoredProps = (props: EventsRequestProps) =>
  omitBy(props, (_value, key) => propNamesToIgnore.includes(key));

class EventsRequest extends React.PureComponent<EventsRequestProps, EventsRequestState> {
  static defaultProps: DefaultProps = {
    period: undefined,
    start: null,
    end: null,
    interval: '1d',
    comparisonDelta: undefined,
    limit: 15,
    query: '',
    includePrevious: true,
    includeTransformedData: true,
  };

  state: EventsRequestState = {
    reloading: !!this.props.loading,
    errored: false,
    timeseriesData: null,
    fetchedWithPrevious: false,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: EventsRequestProps) {
    if (isEqual(omitIgnoredProps(prevProps), omitIgnoredProps(this.props))) {
      return;
    }
    this.fetchData();
  }

  componentWillUnmount() {
    this.unmounting = true;
  }

  private unmounting: boolean = false;

  fetchData = async () => {
    const {api, confirmedQuery, expired, name, hideError, ...props} = this.props;
    let timeseriesData: EventsStats | MultiSeriesEventsStats | null = null;

    if (confirmedQuery === false) {
      return;
    }

    this.setState(state => ({
      reloading: state.timeseriesData !== null,
      errored: false,
      errorMessage: undefined,
    }));

    let errorMessage;
    if (expired) {
      errorMessage = t(
        '%s has an invalid date range. Please try a more recent date range.',
        name
      );
      addErrorMessage(errorMessage, {append: true});

      this.setState({
        errored: true,
        errorMessage,
      });
    } else {
      try {
        api.clear();
        timeseriesData = await doEventsRequest(api, props);
      } catch (resp) {
        if (resp && resp.responseJSON && resp.responseJSON.detail) {
          errorMessage = resp.responseJSON.detail;
        } else {
          errorMessage = t('Error loading chart data');
        }
        if (!hideError) {
          addErrorMessage(errorMessage);
        }
        this.setState({
          errored: true,
          errorMessage,
        });
      }
    }

    if (this.unmounting) {
      return;
    }

    this.setState({
      reloading: false,
      timeseriesData,
      fetchedWithPrevious: props.includePrevious,
    });
  };

  /**
   * Retrieves data set for the current period (since data can potentially
   * contain previous period's data), as well as the previous period if
   * possible.
   *
   * Returns `null` if data does not exist
   */
  getData = (
    data: EventsStatsData
  ): {current: EventsStatsData; previous: EventsStatsData | null} => {
    const {fetchedWithPrevious} = this.state;
    const {period, includePrevious} = this.props;

    const hasPreviousPeriod =
      fetchedWithPrevious || canIncludePreviousPeriod(includePrevious, period);
    // Take the floor just in case, but data should always be divisible by 2
    const dataMiddleIndex = Math.floor(data.length / 2);
    return {
      current: hasPreviousPeriod ? data.slice(dataMiddleIndex) : data,
      previous: hasPreviousPeriod ? data.slice(0, dataMiddleIndex) : null,
    };
  };

  // This aggregates all values per `timestamp`
  calculateTotalsPerTimestamp(
    data: EventsStatsData,
    getName: (
      timestamp: number,
      countArray: {count: number}[],
      i: number
    ) => number = timestamp => timestamp * 1000
  ): SeriesDataUnit[] {
    return data.map(([timestamp, countArray], i) => ({
      name: getName(timestamp, countArray, i),
      value: countArray.reduce((acc, {count}) => acc + count, 0),
    }));
  }

  /**
   * Get previous period data, but transform timestamps so that data fits unto
   * the current period's data axis
   */
  transformPreviousPeriodData(
    current: EventsStatsData,
    previous: EventsStatsData | null,
    seriesName?: string
  ): Series | null {
    // Need the current period data array so we can take the timestamp
    // so we can be sure the data lines up
    if (!previous) {
      return null;
    }

    return {
      seriesName: seriesName ?? 'Previous',
      data: this.calculateTotalsPerTimestamp(
        previous,
        (_timestamp, _countArray, i) => current[i][0] * 1000
      ),
      stack: 'previous',
    };
  }

  /**
   * Aggregate all counts for each time stamp
   */
  transformAggregatedTimeseries(data: EventsStatsData, seriesName: string = ''): Series {
    return {
      seriesName,
      data: this.calculateTotalsPerTimestamp(data),
    };
  }

  /**
   * Transforms query response into timeseries data to be used in a chart
   */
  transformTimeseriesData(data: EventsStatsData, seriesName?: string): Series[] {
    return [
      {
        seriesName: seriesName || 'Current',
        data: data.map(([timestamp, countsForTimestamp]) => ({
          name: timestamp * 1000,
          value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
        })),
      },
    ];
  }

  /**
   * Transforms comparisonCount in query response into timeseries data to be used in a comparison chart for change alerts
   */
  transformComparisonTimeseriesData(data: EventsStatsData): Series[] {
    return [
      {
        seriesName: 'comparisonCount()',
        data: data.map(([timestamp, countsForTimestamp]) => ({
          name: timestamp * 1000,
          value: countsForTimestamp.reduce(
            (acc, {comparisonCount}) => acc + (comparisonCount ?? 0),
            0
          ),
        })),
      },
    ];
  }

  processData(response: EventsStats, seriesIndex: number = 0, seriesName?: string) {
    const {data, totals} = response;
    const {
      includeTransformedData,
      includeTimeAggregation,
      timeAggregationSeriesName,
      currentSeriesNames,
      previousSeriesNames,
      comparisonDelta,
    } = this.props;
    const {current, previous} = this.getData(data);
    const transformedData = includeTransformedData
      ? this.transformTimeseriesData(
          current,
          seriesName ?? currentSeriesNames?.[seriesIndex]
        )
      : [];
    const transformedComparisonData =
      includeTransformedData && comparisonDelta
        ? this.transformComparisonTimeseriesData(current)
        : [];
    const previousData = includeTransformedData
      ? this.transformPreviousPeriodData(
          current,
          previous,
          (seriesName ? getPreviousSeriesName(seriesName) : undefined) ??
            previousSeriesNames?.[seriesIndex]
        )
      : null;
    const timeAggregatedData = includeTimeAggregation
      ? this.transformAggregatedTimeseries(current, timeAggregationSeriesName || '')
      : {};
    const timeframe =
      response.start && response.end
        ? !previous
          ? {
              start: response.start * 1000,
              end: response.end * 1000,
            }
          : {
              // Find the midpoint of start & end since previous includes 2x data
              start: (response.start + response.end) * 500,
              end: response.end * 1000,
            }
        : undefined;
    return {
      data: transformedData,
      comparisonData: transformedComparisonData,
      allData: data,
      originalData: current,
      totals,
      originalPreviousData: previous,
      previousData,
      timeAggregatedData,
      timeframe,
    };
  }

  render() {
    const {children, showLoading, ...props} = this.props;
    const {timeseriesData, reloading, errored, errorMessage} = this.state;
    // Is "loading" if data is null
    const loading = this.props.loading || timeseriesData === null;

    if (showLoading && loading) {
      return <LoadingPanel data-test-id="events-request-loading" />;
    }
    if (isMultiSeriesStats(timeseriesData)) {
      // Convert multi-series results into chartable series. Multi series results
      // are created when multiple yAxis are used or a topEvents request is made.
      // Convert the timeseries data into a multi-series result set.
      // As the server will have replied with a map like:
      // {[titleString: string]: EventsStats}
      let timeframe: {end: number; start: number} | undefined = undefined;
      const sortedTimeseriesData = Object.keys(timeseriesData)
        .map((seriesName: string, index: number): [number, Series, Series | null] => {
          const seriesData: EventsStats = timeseriesData[seriesName];
          const processedData = this.processData(
            seriesData,
            index,
            stripEquationPrefix(seriesName)
          );
          if (!timeframe) {
            timeframe = processedData.timeframe;
          }
          return [
            seriesData.order || 0,
            processedData.data[0],
            processedData.previousData,
          ];
        })
        .sort((a, b) => a[0] - b[0]);
      const results: Series[] = sortedTimeseriesData.map(item => {
        return item[1];
      });
      const previousTimeseriesData: Series[] | undefined = sortedTimeseriesData.some(
        item => item[2] === null
      )
        ? undefined
        : sortedTimeseriesData.map(item => {
            return item[2] as Series;
          });

      return children({
        loading,
        reloading,
        errored,
        errorMessage,
        results,
        timeframe,
        previousTimeseriesData,
        // sometimes we want to reference props that were given to EventsRequest
        ...props,
      });
    }
    if (timeseriesData) {
      const {
        data: transformedTimeseriesData,
        comparisonData: transformedComparisonTimeseriesData,
        allData: allTimeseriesData,
        originalData: originalTimeseriesData,
        totals: timeseriesTotals,
        originalPreviousData: originalPreviousTimeseriesData,
        previousData: previousTimeseriesData,
        timeAggregatedData,
        timeframe,
      } = this.processData(timeseriesData);

      return children({
        loading,
        reloading,
        errored,
        errorMessage,
        // timeseries data
        timeseriesData: transformedTimeseriesData,
        comparisonTimeseriesData: transformedComparisonTimeseriesData,
        allTimeseriesData,
        originalTimeseriesData,
        timeseriesTotals,
        originalPreviousTimeseriesData,
        previousTimeseriesData: previousTimeseriesData
          ? [previousTimeseriesData]
          : previousTimeseriesData,
        timeAggregatedData,
        timeframe,
        // sometimes we want to reference props that were given to EventsRequest
        ...props,
      });
    }
    return children({
      loading,
      reloading,
      errored,
      errorMessage,
      ...props,
    });
  }
}
export default EventsRequest;
