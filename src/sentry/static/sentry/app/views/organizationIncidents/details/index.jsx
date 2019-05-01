import React from 'react';
import PropTypes from 'prop-types';

import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import {PageContent} from 'app/styles/organization';
import withApi from 'app/utils/withApi';

import IncidentHeader from './header';
import Incidents from './incidents';
import {fetchIncident} from '../utils';

class OrganizationIncidentDetails extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {isLoading: false, hasError: false};
  }

  componentDidMount() {
    this.fetchData();
  }

  fetchData() {
    this.setState({isLoading: true, hasError: false});
    const {
      api,
      params: {orgId, incidentId},
    } = this.props;

    fetchIncident(api, orgId, incidentId)
      .then(incident => {
        this.setState({incident, isLoading: false, hasError: false});
      })
      .catch(() => {
        this.setState({isLoading: false, hasError: true});
      });
  }

  render() {
    const {incident, isLoading, hasError} = this.state;
    return (
      <React.Fragment>
        <IncidentHeader params={this.props.params} incident={incident} />
        {incident && <Incidents incident={incident} />}
        {isLoading && (
          <PageContent>
            <LoadingIndicator />
          </PageContent>
        )}
        {hasError && (
          <PageContent>
            <LoadingError />
          </PageContent>
        )}
      </React.Fragment>
    );
  }
}

export {OrganizationIncidentDetails};
export default withApi(OrganizationIncidentDetails);
