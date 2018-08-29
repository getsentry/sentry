import {isEqual} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {doHealthRequest} from 'app/actionCreators/health';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withLatestContext from 'app/utils/withLatestContext';

import HealthContext from './healthContext';

class HealthRequestWithParams extends React.Component {
  static propTypes = {
    /**
     * API client instance
     */
    api: PropTypes.object.isRequired,

    organization: SentryTypes.Organization.isRequired,

    /**
     * Health tag (this will use a BASE_URL defined in health actionCreators
     */
    tag: PropTypes.string.isRequired,

    /**
     * List of project ids to query
     */
    projects: PropTypes.arrayOf(PropTypes.string),

    /**
     * List of environments to query
     */
    environments: PropTypes.arrayOf(PropTypes.string),

    /**
     * Time period in query. Currently only supports relative dates
     *
     * e.g. 24h, 7d, 30d
     */
    period: PropTypes.string,

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
     * Should we query for timeseries data
     */
    timeseries: PropTypes.bool,

    /**
     * number of rows to return
     */
    limit: PropTypes.number,

    /**
     * topK value
     */
    topk: PropTypes.number,

    /**
     * Callback function to process category
     */
    getCategory: PropTypes.func,

    /**
     * Transform the response data to be something ingestible by charts
     */
    includeTransformedData: PropTypes.bool,

    /**
     * Include a dataset transform that will aggregate count values for each timestamp.
     * Note this expects a string for the series name to be used for the aggregated series.
     */
    includeTimeAggregation: PropTypes.string,

    /**
     * Include a map of series name -> percentage integers
     *
     * This is only valid for non-timeseries data
     */
    includePercentages: PropTypes.bool,
  };

  static defaultProps = {
    period: '7d',
    includePrevious: true,
    timeseries: true,
    interval: '1d',
    limit: 15,
    getCategory: i => i,
    includeTransformedData: true,
  };

  constructor(props) {
    super(props);
    this.state = {
      data: null,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (isEqual(prevProps, this.props)) return;

    this.fetchData();
  }

  fetchData() {
    let {api, ...props} = this.props;
    doHealthRequest(api, props).then(({data, totals}) => {
      this.setState({
        data,
        totals,
      });
    });
  }

  // Is going to be called with an object with `value` and `_health_id`
  getCategory = ({value} = {}) => {
    return this.props.getCategory(value);
  };

  /**
   * Retrieves data set for the current period (since data can potentially contain previous period's data), as
   * well as the previous period if possible.
   *
   * Returns `null` if data does not exist
   */
  getData = () => {
    const {timeseries, includePrevious} = this.props;
    const {data} = this.state;
    if (!data) {
      return {
        previous: null,
        current: null,
      };
    }

    const hasPreviousPeriod = timeseries && includePrevious;
    const dataMiddleIndex = data.length / 2;

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

  transformSeriesPercentageMap = (transformedData, total) => {
    return new Map(
      transformedData.map(([name, value]) => [
        name,
        Math.round(value / total * 10000) / 100,
      ])
    );
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
  transformAggregatedTimeseries = (data, name) => {
    if (!data) return null;

    return {
      seriesName: name,
      data: this.calculateTotalsPerTimestamp(data),
    };
  };

  /**
   * Transforms query response into timeseries data to be used in a chart
   */
  transformTimeseriesData = (data, tag) => {
    const categorySet = new Set();
    const timestampMap = new Map();

    data.forEach(([timestamp, resultsForTimestamp]) => {
      resultsForTimestamp &&
        !!resultsForTimestamp.length &&
        resultsForTimestamp.forEach(({count, [tag]: tagObject}) => {
          categorySet.add(this.getCategory(tagObject));
          timestampMap.set(`${timestamp}-${this.getCategory(tagObject)}`, count);
        });
    });

    return Array.from(categorySet).map(seriesName => {
      return {
        seriesName,
        data: data.map(([timestamp]) => ({
          name: timestamp * 1000,
          value: timestampMap.get(`${timestamp}-${seriesName}`) || 0,
        })),
      };
    });
  };

  /**
   * Transforms query response into a non-timeseries data to be used in a chart
   */
  transformNonTimeSeriesData = (data, tag) =>
    data.map(({[tag]: tagObject, count}) => [this.getCategory(tagObject), count]);

  transformData = data => {
    const {timeseries, tag} = this.props;
    if (!data) return null;

    return timeseries
      ? this.transformTimeseriesData(data, tag)
      : this.transformNonTimeSeriesData(data, tag);
  };

  render() {
    const {
      children,
      includeTimeAggregation,
      includeTransformedData,
      includePercentages,
      tag,
      timeseries,
      ...props
    } = this.props;
    const {data, totals} = this.state;
    const {current, previous} = this.getData();
    const shouldIncludePercentages = includePercentages && !timeseries;
    const transformedData =
      includeTransformedData || shouldIncludePercentages
        ? this.transformData(current)
        : null;

    const percentageMap =
      shouldIncludePercentages &&
      totals &&
      this.transformSeriesPercentageMap(transformedData, totals.count);

    const dataWithPercentages =
      shouldIncludePercentages && current
        ? current.map(({count, lastCount, [tag]: tagObject}) => {
            const name = this.getCategory(tagObject);

            return {
              count,
              lastCount,
              name,
              percentage: percentageMap.get(name),
            };
          })
        : null;

    return children({
      // Is "loading" if data is null
      loading: data === null,

      // Current period, transformed data
      data: transformedData,

      dataWithPercentages,

      // Previous period, transformed and aggregated data
      previousData: includeTransformedData
        ? this.transformPreviousPeriodData(current, previous)
        : null,

      // Current period data aggregated by time
      timeAggregatedData: includeTimeAggregation
        ? this.transformAggregatedTimeseries(current, includeTimeAggregation)
        : null,

      // All data
      allData: data,

      // Current period data before any transforms
      originalData: current,

      // Previous period data before any transforms
      originalPreviousData: previous,

      // Totals for current period
      // TODO: this currently isn't accurate because of previous period
      totals,

      // Total counts for previous period
      // TODO: this currently doesn't work
      previousTotals: null,

      // sometimes we want to reference props that were given to HealthRequest
      tag,
      timeseries,
      ...props,
    });
  }
}

const HealthRequest = withLatestContext(
  withApi(
    class extends React.Component {
      render() {
        return (
          <HealthContext.Consumer>
            {({projects, environments, period, filters}) => (
              <HealthRequestWithParams
                projects={projects}
                environments={environments}
                period={period}
                filters={filters}
                {...this.props}
              />
            )}
          </HealthContext.Consumer>
        );
      }
    }
  )
);

export default HealthRequest;
export {HealthRequestWithParams};
