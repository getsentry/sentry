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
    api: PropTypes.object,

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
    doHealthRequest(api, props).then(({data}) => {
      this.setState({
        data,
      });
    });
  }

  transformTimeseriesData = () => {
    let {tag, getCategory} = this.props;
    let {data} = this.state;

    const categorySet = new Set();
    const timestampMap = new Map();

    data.forEach(([timestamp, resultsForTimestamp]) => {
      if (!resultsForTimestamp.length) {
        return;
      }

      resultsForTimestamp.forEach(({count, [tag]: name}) => {
        categorySet.add(getCategory(name));
        timestampMap.set(`${timestamp}-${getCategory(name)}`, count);
      });
    });

    return Array.from(categorySet).map(seriesName => {
      return {
        seriesName,
        data: data.map(([timestamp]) => {
          return {
            name: timestamp * 1000,
            value: timestampMap.get(`${timestamp}-${seriesName}`) || 0,
          };
        }),
      };
    });
  };

  transformData = () => {
    let {timeseries, tag} = this.props;
    let {data} = this.state;
    if (!data) return null;

    return timeseries
      ? this.transformTimeseriesData()
      : data.map(({[tag]: name, count}) => [name, count]);
  };

  render() {
    let {children} = this.props;
    let {data} = this.state;

    return children({
      // Loading if data is null
      loading: data === null,
      data: this.transformData(data),
      originalData: data,
    });
  }
}

const HealthRequest = withLatestContext(
  withApi(
    class extends React.Component {
      render() {
        return (
          <HealthContext.Consumer>
            {({projects, environments, period}) => (
              <HealthRequestWithParams
                projects={projects}
                environments={environments}
                period={period}
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
