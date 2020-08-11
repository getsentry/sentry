import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Organization, Project} from 'app/types';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import IncidentRulesCreate from 'app/views/settings/incidentRules/create';
import IssueEditor from 'app/views/settings/projectAlerts/issueEditor';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withProject from 'app/utils/withProject';
import EventView from 'app/utils/discover/eventView';
import {uniqueId} from 'app/utils/guid';

import AlertTypeChooser from './alertTypeChooser';

type RouteParams = {
  orgId: string;
  projectId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
  hasMetricAlerts: boolean;
};

type AlertType = 'metric' | 'issue' | null;

type State = {
  alertType: AlertType;
  eventView: EventView | undefined;
};

class Create extends React.Component<Props, State> {
  state: State = {
    eventView: undefined,
    alertType: this.props.location.pathname.includes('/alerts/rules/')
      ? 'issue'
      : this.props.location.pathname.includes('/alerts/metric-rules/')
      ? 'metric'
      : null,
  };

  componentDidMount() {
    const {organization, project, location} = this.props;

    trackAnalyticsEvent({
      eventKey: 'new_alert_rule.viewed',
      eventName: 'New Alert Rule: Viewed',
      organization_id: organization.id,
      project_id: project.id,
      session_id: this.sessionId,
    });

    if (location?.query?.createFromDiscover) {
      const eventView = EventView.fromLocation(location);
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({alertType: 'metric', eventView});
    }
  }

  /** Used to track analytics within one visit to the creation page */
  sessionId = uniqueId();

  handleChangeAlertType = (alertType: AlertType) => {
    // alertType should be `issue` or `metric`
    this.setState({alertType});
  };

  render() {
    const {hasMetricAlerts, organization} = this.props;
    const {projectId} = this.props.params;
    const {alertType, eventView} = this.state;

    const shouldShowAlertTypeChooser = hasMetricAlerts;
    const title = t('New Alert');

    return (
      <React.Fragment>
        <SentryDocumentTitle title={title} objSlug={projectId} />
        <SettingsPageHeader title={title} />

        {shouldShowAlertTypeChooser && (
          <AlertTypeChooser
            organization={organization}
            selected={alertType}
            onChange={this.handleChangeAlertType}
          />
        )}

        {(!hasMetricAlerts || alertType === 'issue') && <IssueEditor {...this.props} />}

        {hasMetricAlerts && alertType === 'metric' && (
          <IncidentRulesCreate
            {...this.props}
            eventView={eventView}
            sessionId={this.sessionId}
          />
        )}
      </React.Fragment>
    );
  }
}

export default withProject(Create);
