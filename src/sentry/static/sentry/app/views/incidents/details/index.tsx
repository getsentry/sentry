import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Client} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {fetchOrgMembers} from 'app/actionCreators/members';
import {markIncidentAsSeen} from 'app/actionCreators/incident';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';

import {
  IncidentStatus,
  fetchIncident,
  updateSubscription,
  updateStatus,
  isOpen,
} from '../utils';
import DetailsBody from './body';
import DetailsHeader from './header';
import {Incident} from '../types';

type Props = {
  api: Client;
} & RouteComponentProps<{incidentId: string; orgId: string}, {}>;

type State = {
  isLoading: boolean;
  hasError: boolean;
  incident?: Incident;
};

class IncidentDetails extends React.Component<Props, State> {
  state: State = {isLoading: false, hasError: false};

  componentDidMount() {
    const {api, params} = this.props;
    fetchOrgMembers(api, params.orgId);
    this.fetchData();
  }

  fetchData = async () => {
    this.setState({isLoading: true, hasError: false});

    const {
      api,
      params: {orgId, incidentId},
    } = this.props;

    try {
      const incident = await fetchIncident(api, orgId, incidentId);
      this.setState({incident, isLoading: false, hasError: false});
      markIncidentAsSeen(api, orgId, incident);
    } catch (_err) {
      this.setState({isLoading: false, hasError: true});
    }
  };

  handleSubscriptionChange = async () => {
    const {
      api,
      params: {orgId, incidentId},
    } = this.props;

    if (!this.state.incident) {
      return;
    }

    const isSubscribed = this.state.incident.isSubscribed;

    const newIsSubscribed = !isSubscribed;

    this.setState(state => ({
      incident: {...(state.incident as Incident), isSubscribed: newIsSubscribed},
    }));

    try {
      updateSubscription(api, orgId, incidentId, newIsSubscribed);
    } catch (_err) {
      this.setState(state => ({
        incident: {...(state.incident as Incident), isSubscribed},
      }));
      addErrorMessage(t('An error occurred, your subscription status was not changed.'));
    }
  };

  handleStatusChange = async () => {
    const {
      api,
      params: {orgId, incidentId},
    } = this.props;

    if (!this.state.incident) {
      return;
    }

    const {status} = this.state.incident;

    const newStatus = isOpen(this.state.incident)
      ? IncidentStatus.CLOSED
      : IncidentStatus.CREATED;

    this.setState(state => ({
      incident: {...(state.incident as Incident), status: newStatus},
    }));

    try {
      const incident = await updateStatus(api, orgId, incidentId, newStatus);
      // Update entire incident object because updating status can cause other parts
      // of the model to change (e.g close date)
      this.setState({incident});
    } catch (_err) {
      this.setState(state => ({
        incident: {...(state.incident as Incident), status},
      }));

      addErrorMessage(t('An error occurred, your incident status was not changed.'));
    }
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

        <DetailsBody {...this.props} incident={incident} />
      </React.Fragment>
    );
  }
}

export default withApi(IncidentDetails);
