import {isEqual, omitBy} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {doEventsRequest} from 'app/actionCreators/events';
import LoadingPanel from 'app/views/organizationHealth/loadingPanel';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withLatestContext from 'app/utils/withLatestContext';

import EventsContext from './eventsContext';

class EventsRequestWithParams extends React.Component {
  static propTypes = {
    /**
     * API client instance
     */
    api: PropTypes.object.isRequired,

    organization: SentryTypes.Organization.isRequired,

    /**
     * List of project ids to query
     */
    projects: PropTypes.arrayOf(PropTypes.number),

    /**
     * List of environments to query
     */
    environments: PropTypes.arrayOf(PropTypes.string),

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
     * Transform the response data to be something ingestible by charts
     */
    includeTransformedData: PropTypes.bool,

    /**
     * Include a dataset transform that will aggregate count values for each timestamp.
     * Be sure to supply a name to `timeAggregationSeriesName`
     */
    includeTimeAggregation: PropTypes.bool,

    /**
     * Name of series of aggregated timeseries
     */
    timeAggregationSeriesName: PropTypes.string,

    showLoading: PropTypes.bool,
  };

  static defaultProps = {
    period: null,
    start: null,
    end: null,
    interval: '1d',
    limit: 15,
    getCategory: i => i,
    query: '',

    includePrevious: true,
    includeTransformedData: true,
  };

  constructor(props) {
    super(props);
    this.state = {
      reloading: false,
      timeseriesData: null,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    const propNamesToIgnore = ['api', 'children', 'organizations', 'project'];

    const prevPropsToCheck = omitBy(prevProps, (value, key) =>
      propNamesToIgnore.includes(key)
    );

    const propsToCheck = omitBy(this.props, (value, key) =>
      propNamesToIgnore.includes(key)
    );

    if (isEqual(prevPropsToCheck, propsToCheck)) return;

    this.fetchData();
  }

  componentWillUnmount() {
    this.unmounting = true;
  }

  fetchData = async () => {
    const {api, ...props} = this.props;

    this.setState(state => ({
      reloading: state.timeseriesData !== null,
    }));

    const timeseriesData = await doEventsRequest(api, props);

    if (this.unmounting) return;

    this.setState({
      reloading: false,
      timeseriesData,
    });
  };

  /**
   * Retrieves data set for the current period (since data can potentially contain previous period's data), as
   * well as the previous period if possible.
   *
   * Returns `null` if data does not exist
   */
  getData = data => {
    const {includePrevious} = this.props;

    if (!data) {
      return {
        previous: null,
        current: null,
      };
    }

    const hasPreviousPeriod = includePrevious;
    // Take the floor just in case, but data should always be divisible by 2
    const dataMiddleIndex = Math.floor(data.length / 2);

    return {
      previous: hasPreviousPeriod ? data.slice(0, dataMiddleIndex) : null,
      current: hasPreviousPeriod ? data.slice(dataMiddleIndex) : data,
    };
  };

  // This aggregates all values per `timestamp`
  calculateTotalsPerTimestamp = (data, getName = timestamp => timestamp * 1000) => {
    return data.map(([timestamp, countArray], i) => ({
      name: getName(timestamp, countArray, i),
      value: countArray.reduce((acc, {count}) => acc + count, 0),
    }));
  };

  /**
   * Get previous period data, but transform timestampts so that data fits unto the current period's data axis
   */
  transformPreviousPeriodData = (current, previous) => {
    // Need the current period data array so we can take the timestamp
    // so we can be sure the data lines up
    if (!previous) return [];

    return {
      seriesName: 'Previous Period',
      data: this.calculateTotalsPerTimestamp(
        previous,
        (timestamp, countArray, i) => current[i][0] * 1000
      ),
    };
  };

  /**
   * Aggregate all counts for each time stamp
   */
  transformAggregatedTimeseries = (data, seriesName) => {
    if (!data) return null;

    return {
      seriesName,
      data: this.calculateTotalsPerTimestamp(data),
    };
  };

  /**
   * Transforms query response into timeseries data to be used in a chart
   */
  transformTimeseriesData = data => {
    return [
      {
        seriesName: 'Events',
        data: data.map(([timestamp, countsForTimestamp]) => ({
          name: timestamp * 1000,
          value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
        })),
      },
    ];
  };

  transformData = data => {
    if (!data) return null;

    return this.transformTimeseriesData(data);
  };

  processData({data, totals} = {}) {
    const {
      includeTransformedData,
      includeTimeAggregation,
      timeAggregationSeriesName,
    } = this.props;
    const {current, previous} = this.getData(data);
    const transformedData = includeTransformedData ? this.transformData(current) : null;

    const previousData = includeTransformedData
      ? this.transformPreviousPeriodData(current, previous)
      : null;

    const timeAggregatedData = includeTimeAggregation
      ? this.transformAggregatedTimeseries(current, timeAggregationSeriesName)
      : null;

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
    const loading = reloading || timeseriesData === null;

    if (showLoading && loading) {
      return <LoadingPanel />;
    }

    const {
      data: transformedTimeseriesData,
      allData: allTimeseriesData,
      originalData: originalTimeseriesData,
      totals: timeseriesTotals,
      originalPreviousData: originalPreviousTimeseriesData,
      previousData: previousTimeseriesData,
      timeAggregatedData,
    } =
      (timeseriesData && this.processData(timeseriesData, true)) || {};

    return children({
      loading,

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

const EventsRequest = withLatestContext(
  withApi(
    class EventsRequest extends React.Component {
      render() {
        return (
          <EventsContext.Consumer>
            {({projects, environments, period, filters}) => (
              <EventsRequestWithParams
                projects={projects}
                environments={environments}
                period={period}
                filters={filters}
                {...this.props}
              />
            )}
          </EventsContext.Consumer>
        );
      }
    }
  )
);

export default EventsRequest;
export {EventsRequestWithParams};
