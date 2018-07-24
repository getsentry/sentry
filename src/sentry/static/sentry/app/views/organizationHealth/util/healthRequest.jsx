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
     * Health tag (this will use a BASE_URL defined in health actionCreators
     */
    tag: PropTypes.string.isRequired,

    organization: SentryTypes.Organization.isRequired,

    api: PropTypes.object,

    /**
     * List of project ids to query
     */
    projects: PropTypes.arrayOf(PropTypes.number),

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
  };

  static defaultProps = {
    period: '7d',
    includePrevious: true,
    timeseries: true,
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
    if (
      isEqual(prevProps.projects, this.props.projects) &&
      isEqual(prevProps.environments, this.props.environments) &&
      isEqual(prevProps.period, this.props.period) &&
      isEqual(prevProps.organization, this.props.organization)
    ) {
      return;
    }
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

  render() {
    let {children} = this.props;
    let {data} = this.state;
    return children({
      // Loading if data is null
      loading: data === null,
      data,
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
