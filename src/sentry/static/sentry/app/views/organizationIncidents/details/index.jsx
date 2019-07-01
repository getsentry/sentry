import PropTypes from 'prop-types';
import React from 'react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {fetchOrgMembers} from 'app/actionCreators/members';
import {markIncidentAsSeen} from 'app/actionCreators/incident';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';

import {
  INCIDENT_STATUS,
  fetchIncident,
  updateSubscription,
  updateStatus,
  isOpen,
} from '../utils';
import DetailsBody from './body';
import DetailsHeader from './header';

class OrganizationIncidentDetails extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {isLoading: false, hasError: false};
  }

  componentDidMount() {
    const {api, params} = this.props;
    fetchOrgMembers(api, params.orgId);
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
        markIncidentAsSeen(api, orgId, incident);
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

    const isSubscribed = this.state.incident.isSubscribed;

    const newIsSubscribed = !isSubscribed;

    this.setState(state => ({
      incident: {...state.incident, isSubscribed: newIsSubscribed},
    }));

    updateSubscription(api, orgId, incidentId, newIsSubscribed).catch(() => {
      this.setState(state => ({
        incident: {...state.incident, isSubscribed},
      }));
      addErrorMessage(t('An error occurred, your subscription status was not changed.'));
    });
  };

  handleStatusChange = () => {
    const {
      api,
      params: {orgId, incidentId},
    } = this.props;

    const {status} = this.state.incident;

    const newStatus = isOpen(this.state.incident)
      ? INCIDENT_STATUS.CLOSED
      : INCIDENT_STATUS.CREATED;

    this.setState(state => ({
      incident: {...state.incident, status: newStatus},
    }));

    updateStatus(api, orgId, incidentId, newStatus)
      .then(incident => {
        // Update entire incident object because updating status can cause other parts
        // of the model to change (e.g close date)
        this.setState({incident});
      })
      .catch(() => {
        this.setState(state => ({
          incident: {...state.incident, status},
        }));

        addErrorMessage(t('An error occurred, your incident status was not changed.'));
      });
  };

  render() {
    const {incident, hasError} = this.state;
    const {params} = this.props;

    return (
      <React.Fragment>
        <DetailsHeader
          hasIncidentDetailsError={hasError}
          params={params}
          incident={incident}
          onSubscriptionChange={this.handleSubscriptionChange}
          onStatusChange={this.handleStatusChange}
        />

        <DetailsBody
          hasIncidentDetailsError={hasError}
          params={params}
          incident={incident}
        />
      </React.Fragment>
    );
  }
}

export {OrganizationIncidentDetails};
export default withApi(OrganizationIncidentDetails);
