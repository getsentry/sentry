import {isEqual, omitBy} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {Organization, EventsStats, EventsStatsData} from 'app/types';
import {Series, SeriesDataUnit} from 'app/types/echarts';

import {Client} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {canIncludePreviousPeriod} from 'app/views/events/utils/canIncludePreviousPeriod';
import {doEventsRequest} from 'app/actionCreators/events';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';

import LoadingPanel from '../loadingPanel';

type RenderProps = {
  loading: boolean;
  reloading: boolean;

  // timeseries data
  timeseriesData?: Series[];
  allTimeseriesData?: EventsStatsData;
  originalTimeseriesData?: EventsStatsData;
  timeseriesTotals?: object;
  originalPreviousTimeseriesData?: EventsStatsData | null;
  previousTimeseriesData?: Series | null;
  timeAggregatedData?: Series | {};
};

type EventsRequestPartialProps = {
  api: Client;
  organization: Organization;

  project?: number[];
  environment?: string[];
  period?: string;
  start?: any;
  end?: any;
  interval?: string;
  field?: string[];
  referenceEvent?: string;

  limit?: number;
  query?: string;
  includePrevious?: boolean;
  includeTransformedData?: boolean;
  loading?: boolean;
  showLoading?: boolean;
  yAxis?: string;
  children: (renderProps: RenderProps) => React.ReactNode;
};

type TimeAggregationProps =
  | {includeTimeAggregation: true; timeAggregationSeriesName: string}
  | {includeTimeAggregation?: false; timeAggregationSeriesName?: undefined};

type EventsRequestProps = TimeAggregationProps & EventsRequestPartialProps;

type EventsRequestState = {
  reloading: boolean;
  timeseriesData: null | EventsStats;
};

const propNamesToIgnore = ['api', 'children', 'organization', 'loading'];
const omitIgnoredProps = (props: EventsRequestProps) =>
  omitBy(props, (_value, key) => propNamesToIgnore.includes(key));

class EventsRequest extends React.PureComponent<EventsRequestProps, EventsRequestState> {
  static propTypes = {
    /**
     * API client instance
     */
    api: PropTypes.object.isRequired,

    organization: SentryTypes.Organization.isRequired,

    /**
     * List of project ids to query
     */
    project: PropTypes.arrayOf(PropTypes.number),

    /**
     * List of environments to query
     */
    environment: PropTypes.arrayOf(PropTypes.string),

    /**
     * Relative time period for query.
     *
     * Use `start` and `end` for absolute dates.
     *
     * e.g. 24h, 7d, 30d
     */
    period: PropTypes.string,

    /**
     * Absolute start date for query
     */
    start: PropTypes.instanceOf(Date),

    /**
     * Absolute end date for query
     */
    end: PropTypes.instanceOf(Date),

    /**
     * Interval to group results in
     *
     * e.g. 1d, 1h, 1m, 1s
     */
    interval: PropTypes.string,

    /**
     * Include data for previous period
     */
    includePrevious: PropTypes.bool,

    /**
     * number of rows to return
     */
    limit: PropTypes.number,

    /**
     * The query string to search events by
     */
    query: PropTypes.string,

    /**
     * Transform the response data to be something ingestible by charts
     */
    includeTransformedData: PropTypes.bool,

    /**
     * Include a dataset transform that will aggregate count values for each
     * timestamp. Be sure to supply a name to `timeAggregationSeriesName`
     */
    includeTimeAggregation: PropTypes.bool,

    /**
     * Name of series of aggregated timeseries
     */
    timeAggregationSeriesName: PropTypes.string,

    /**
     * Initial loading state
     */
    loading: PropTypes.bool,

    /**
     * Should loading be shown.
     */
    showLoading: PropTypes.bool,

    /**
     * The yAxis being plotted
     */
    yAxis: PropTypes.string,

    field: PropTypes.arrayOf(PropTypes.string),
    referenceEvent: PropTypes.string,
  };

  static defaultProps = {
    period: null,
    start: null,
    end: null,
    interval: '1d',
    limit: 15,
    query: '',

    includePrevious: true,
    includeTransformedData: true,
  };

  state = {
    reloading: !!this.props.loading,
    timeseriesData: null,
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
    const {api, ...props} = this.props;
    let timeseriesData: EventsStats | null = null;

    this.setState(state => ({
      reloading: state.timeseriesData !== null,
    }));

    try {
      timeseriesData = await doEventsRequest(api, props);
    } catch (resp) {
      if (resp && resp.responseJSON && resp.responseJSON.detail) {
        addErrorMessage(resp.responseJSON.detail);
      } else {
        addErrorMessage(t('Error loading chart data'));
      }
    }

    if (this.unmounting) {
      return;
    }

    this.setState({
      reloading: false,
      timeseriesData,
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
  ): {previous: EventsStatsData | null; current: EventsStatsData} => {
    const {period, includePrevious} = this.props;

    const hasPreviousPeriod = canIncludePreviousPeriod(includePrevious, period);
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
    previous: EventsStatsData | null
  ): Series | null {
    // Need the current period data array so we can take the timestamp
    // so we can be sure the data lines up
    if (!previous) {
      return null;
    }

    return {
      seriesName: 'Previous Period',
      data: this.calculateTotalsPerTimestamp(
        previous,
        (_timestamp, _countArray, i) => current[i][0] * 1000
      ),
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
  transformTimeseriesData(data: EventsStatsData): [Series] {
    return [
      {
        seriesName: 'Current Period',
        data: data.map(([timestamp, countsForTimestamp]) => ({
          name: timestamp * 1000,
          value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
        })),
      },
    ];
  }

  processData(response: EventsStats | null) {
    if (!response) {
      return {};
    }

    const {data, totals} = response;
    const {
      includeTransformedData,
      includeTimeAggregation,
      timeAggregationSeriesName,
    } = this.props;
    const {current, previous} = this.getData(data);
    const transformedData = includeTransformedData
      ? this.transformTimeseriesData(current)
      : [];
    const previousData = includeTransformedData
      ? this.transformPreviousPeriodData(current, previous)
      : null;
    const timeAggregatedData = includeTimeAggregation
      ? this.transformAggregatedTimeseries(current, timeAggregationSeriesName || '')
      : {};
    return {
      data: transformedData,
      allData: data,
      originalData: current,
      totals,
      originalPreviousData: previous,
      previousData,
      timeAggregatedData,
    };
  }

  render() {
    const {children, showLoading, ...props} = this.props;
    const {timeseriesData, reloading} = this.state;
    // Is "loading" if data is null
    const loading = this.props.loading || timeseriesData === null;

    if (showLoading && loading) {
      return <LoadingPanel data-test-id="events-request-loading" />;
    }

    const {
      data: transformedTimeseriesData,
      allData: allTimeseriesData,
      originalData: originalTimeseriesData,
      totals: timeseriesTotals,
      originalPreviousData: originalPreviousTimeseriesData,
      previousData: previousTimeseriesData,
      timeAggregatedData,
    } = this.processData(timeseriesData);

    return children({
      loading,
      reloading,
      // timeseries data
      timeseriesData: transformedTimeseriesData,
      allTimeseriesData,
      originalTimeseriesData,
      timeseriesTotals,
      originalPreviousTimeseriesData,
      previousTimeseriesData,
      timeAggregatedData,
      // sometimes we want to reference props that were given to EventsRequest
      ...props,
    });
  }
}
export default EventsRequest;
