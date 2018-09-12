import {isEqual, pickBy} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {doHealthRequest} from 'app/actionCreators/health';
import LoadingPanel from 'app/views/organizationHealth/loadingPanel';
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
     * number of rows to return
     */
    limit: PropTypes.number,

    /**
     * topK value, currently only hardcoded for topk projects
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
     * Be sure to supply a name to `timeAggregationSeriesName`
     */
    includeTimeAggregation: PropTypes.bool,

    /**
     * Name of series of aggregated timeseries
     */
    timeAggregationSeriesName: PropTypes.string,

    /**
     * Include a map of series name -> percentage integers
     *
     * This is only valid for non-timeseries data
     */
    includePercentages: PropTypes.bool,

    includeTimeseries: PropTypes.bool,

    includeTop: PropTypes.bool,

    showLoading: PropTypes.bool,
  };

  static defaultProps = {
    period: '7d',
    interval: '1d',
    limit: 15,
    getCategory: i => i,

    includeTimeseries: true,
    includePrevious: true,
    includeTransformedData: true,
  };

  constructor(props) {
    super(props);
    this.state = {
      reloading: false,
      tagData: null,
      timeseriesData: null,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    const propNamesToCheck = [
      'environments',
      'includePrevious',
      'includeTimeseries',
      'includeTop',
      'includeTransformedData',
      'interval',
      'limit',
      'period',
      'projects',
      'showLoading',
      'specifiers',
      'tag',
    ];

    const prevPropsToCheck = pickBy(prevProps, (value, key) =>
      propNamesToCheck.includes(key)
    );

    const propsToCheck = pickBy(this.props, (value, key) =>
      propNamesToCheck.includes(key)
    );

    if (isEqual(prevPropsToCheck, propsToCheck)) return;

    this.fetchData();
  }

  fetchData = async () => {
    const {tag} = this.props;

    this.setState(state => ({
      reloading: state.tagData !== null && state.timeseriesData !== null,
    }));

    // If `includeTop` is defined and > 0, we need to fetch the top tags ordered by count
    // And then if we need timeseries, we'll pass the specific tag values into the timeseries query
    // to fetch only the counts for those tag values.
    const tagData = await this.fetchTopTag();
    const tagSpecifiers =
      (tagData &&
        tagData.data &&
        tagData.data
          .map(({[tag]: tagObject}) => tagObject && tagObject._health_id)
          .filter(id => !!id)) ||
      null;

    const timeseriesData = await this.fetchTimeseriesData({
      ...(tagSpecifiers && tagSpecifiers.length
        ? {
            specifiers: tagSpecifiers,
          }
        : {}),
    });

    this.setState({
      reloading: false,
      tagData,
      timeseriesData,
    });
  };

  fetchTopTag = otherProps => {
    const {api, includeTop, ...props} = this.props;

    if (!includeTop) return Promise.resolve({});

    return doHealthRequest(api, {...props, ...otherProps, timeseries: false});
  };

  fetchTimeseriesData = otherProps => {
    const {api, includeTimeseries, ...props} = this.props;
    if (!includeTimeseries) return Promise.resolve({});
    return doHealthRequest(api, {...props, ...otherProps, timeseries: true});
  };

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
  getData = (data, isTimeseries) => {
    const {includePrevious} = this.props;

    if (!data) {
      return {
        previous: null,
        current: null,
      };
    }

    const hasPreviousPeriod = isTimeseries && includePrevious;
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

  transformData = (data, isTimeseries) => {
    const {tag} = this.props;
    if (!data) return null;

    return isTimeseries
      ? this.transformTimeseriesData(data, tag)
      : this.transformNonTimeSeriesData(data, tag);
  };

  processData({data, totals} = {}, isTimeseries) {
    const {
      tag,
      includeTransformedData,
      includePercentages,
      includeTimeAggregation,
      includeTop,
      timeAggregationSeriesName,
    } = this.props;
    const shouldIncludePercentages = includePercentages && includeTop && !isTimeseries;
    const {current, previous} = this.getData(data, isTimeseries);
    const transformedData =
      includeTransformedData || shouldIncludePercentages
        ? this.transformData(current, isTimeseries)
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

    const previousData =
      isTimeseries && includeTransformedData
        ? this.transformPreviousPeriodData(current, previous)
        : null;

    const timeAggregatedData =
      isTimeseries && includeTimeAggregation
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
      dataWithPercentages,
    };
  }

  render() {
    const {children, tag, showLoading, ...props} = this.props;

    const {tagData, timeseriesData, reloading} = this.state;

    // Is "loading" if data is null
    const loading = reloading || (tagData === null || timeseriesData === null);

    if (showLoading && loading) {
      return <LoadingPanel />;
    }

    const {
      data: transformedTagData,
      allData: allTagData,
      originalData: originalTagData,
      totals: tagTotals,
      dataWithPercentages: tagDataWithPercentages,
    } =
      (tagData && this.processData(tagData)) || {};

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

      // tg data
      tagData: transformedTagData,
      allTagData,
      originalTagData,
      tagTotals,
      tagDataWithPercentages,

      // timeseries data
      timeseriesData: transformedTimeseriesData,
      allTimeseriesData,
      originalTimeseriesData,
      timeseriesTotals,
      originalPreviousTimeseriesData,
      previousTimeseriesData,
      timeAggregatedData,

      // sometimes we want to reference props that were given to HealthRequest
      tag,
      ...props,
    });
  }
}

const HealthRequest = withLatestContext(
  withApi(
    class HealthRequest extends React.Component {
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
