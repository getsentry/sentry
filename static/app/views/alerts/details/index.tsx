import {Component, Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import {Location} from 'history';

import {markIncidentAsSeen} from 'app/actionCreators/incident';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {fetchOrgMembers} from 'app/actionCreators/members';
import {Client} from 'app/api';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withApi from 'app/utils/withApi';

import {AlertRuleStatus, Incident, IncidentStats, IncidentStatus} from '../types';
import {
  fetchIncident,
  fetchIncidentStats,
  isOpen,
  updateStatus,
  updateSubscription,
} from '../utils';

import DetailsBody from './body';
import DetailsHeader from './header';

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
} & RouteComponentProps<{alertId: string; orgId: string}, {}>;

type State = {
  isLoading: boolean;
  hasError: boolean;
  incident?: Incident;
  stats?: IncidentStats;
};

export const alertDetailsLink = (organization: Organization, incident: Incident) =>
  `/organizations/${organization.slug}/alerts/rules/details/${
    incident?.alertRule.status === AlertRuleStatus.SNAPSHOT &&
    incident?.alertRule.originalAlertRuleId
      ? incident?.alertRule.originalAlertRuleId
      : incident?.alertRule.id
  }/`;

class IncidentDetails extends Component<Props, State> {
  state: State = {isLoading: false, hasError: false};

  componentDidMount() {
    const {api, organization, params} = this.props;

    trackAnalyticsEvent({
      eventKey: 'alert_details.viewed',
      eventName: 'Alert Details: Viewed',
      organization_id: parseInt(organization.id, 10),
      alert_id: parseInt(params.alertId, 10),
    });

    fetchOrgMembers(api, params.orgId);

    this.fetchData();
  }

  fetchData = async () => {
    this.setState({isLoading: true, hasError: false});

    const {
      api,
      location,
      organization,
      params: {orgId, alertId},
    } = this.props;

    try {
      const incidentPromise = fetchIncident(api, orgId, alertId).then(incident => {
        const hasRedesign =
          incident.alertRule &&
          this.props.organization.features.includes('alert-details-redesign');
        // only stop redirect if param is explicitly set to false
        const stopRedirect =
          location && location.query && location.query.redirect === 'false';
        if (hasRedesign && !stopRedirect) {
          browserHistory.replace({
            pathname: alertDetailsLink(organization, incident),
            query: {alert: incident.identifier},
          });
        }

        this.setState({incident});
        markIncidentAsSeen(api, orgId, incident);
      });

      const statsPromise = fetchIncidentStats(api, orgId, alertId).then(stats =>
        this.setState({stats})
      );

      // State not set after promise.all because stats *usually* takes
      // more time than the incident api
      await Promise.all([incidentPromise, statsPromise]);
      this.setState({isLoading: false, hasError: false});
    } catch (_err) {
      this.setState({isLoading: false, hasError: true});
    }
  };

  handleSubscriptionChange = async () => {
    const {
      api,
      params: {orgId, alertId},
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
      updateSubscription(api, orgId, alertId, newIsSubscribed);
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
      params: {orgId, alertId},
    } = this.props;

    if (!this.state.incident) {
      return;
    }

    const {status} = this.state.incident;

    const newStatus = isOpen(this.state.incident) ? IncidentStatus.CLOSED : status;

    this.setState(state => ({
      incident: {...(state.incident as Incident), status: newStatus},
    }));

    try {
      const incident = await updateStatus(api, orgId, alertId, newStatus);
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
    const {incident, stats, hasError} = this.state;
    const {params, organization} = this.props;
    const {alertId} = params;

    const project = incident?.projects?.[0];

    return (
      <Fragment>
        <SentryDocumentTitle
          title={t('Alert %s', alertId)}
          orgSlug={organization.slug}
          projectSlug={project}
        />
        <DetailsHeader
          hasIncidentDetailsError={hasError}
          params={params}
          incident={incident}
          stats={stats}
          onSubscriptionChange={this.handleSubscriptionChange}
          onStatusChange={this.handleStatusChange}
        />
        <DetailsBody {...this.props} incident={incident} stats={stats} />
      </Fragment>
    );
  }
}

export default withApi(IncidentDetails);
