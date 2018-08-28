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
     * topK value
     */
    topk: PropTypes.number,

    /**
     * Callback function to process category
     */
    getCategory: PropTypes.func,
  };

  static defaultProps = {
    period: '7d',
    includePrevious: true,
    timeseries: true,
    interval: '1d',
    getCategory: i => i,
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

  getPreviousPeriod = () => {
    const {timeseries, includePrevious} = this.props;
    const {data} = this.state;
    if (!data) return null;
    if (!timeseries || !includePrevious) return [];

    const previousPeriodData = data.slice(0, data.length / 2);

    // Need the current period data array so we can take the timestamp
    // so we can be sure the data lines up
    const currentPeriodData = data.slice(data.length / 2);

    return {
      seriesName: 'Previous Period',
      data: previousPeriodData.map(([timestamp, countArray], i) => ({
        name: currentPeriodData[i][0] * 1000,
        value: countArray.reduce((acc, {count}) => acc + count, 0),
      })),
    };
  };

  transformTimeseriesData = () => {
    const {includePrevious, tag} = this.props;
    let {data} = this.state;

    const categorySet = new Set();
    const timestampMap = new Map();

    // If include previous we need to split data into 2 sets of arrays
    data = includePrevious ? data.slice(data.length / 2) : data;

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

  transformData = () => {
    const {timeseries, tag} = this.props;
    const {data} = this.state;
    if (!data) return null;

    return timeseries
      ? this.transformTimeseriesData()
      : data.map(({[tag]: tagObject, count}) => [this.getCategory(tagObject), count]);
  };

  render() {
    const {children, ...props} = this.props;
    const {data, totals} = this.state;

    return children({
      // Loading if data is null
      loading: data === null,
      data: this.transformData(),
      totals,
      originalData: data,
      previousPeriod: this.getPreviousPeriod(),

      // sometimes we want to reference props that was given to HealthRequest
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
