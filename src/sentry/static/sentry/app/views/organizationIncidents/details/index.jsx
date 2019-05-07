import React from 'react';
import PropTypes from 'prop-types';

import {addErrorMessage} from 'app/actionCreators/indicator';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import {PageContent} from 'app/styles/organization';
import withApi from 'app/utils/withApi';
import {t} from 'app/locale';

import IncidentHeader from './header';
import Incidents from './incidents';
import {fetchIncident, updateSubscription} from '../utils';

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

  fetchData = () => {
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
  };

  handleSubscriptionChange = () => {
    const {
      api,
      params: {orgId, incidentId},
    } = this.props;

    const isSubscribed = !this.state.incident.isSubscribed;

    updateSubscription(api, orgId, incidentId, isSubscribed)
      .then(() => {
        this.setState(state => ({
          incident: {...state.incident, isSubscribed},
        }));
      })
      .catch(() => {
        addErrorMessage(
          t('An error occurred, your subscription status was not changed.')
        );
      });
  };

  render() {
    const {incident, isLoading, hasError} = this.state;

    return (
      <React.Fragment>
        <IncidentHeader
          params={this.props.params}
          incident={incident}
          onSubscriptionChange={this.handleSubscriptionChange}
        />
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
