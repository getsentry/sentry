import {RouteComponentProps} from 'react-router/lib/Router';
import { Component, Fragment } from 'react';
import styled from '@emotion/styled';

import {Organization, Project} from 'app/types';
import {PageContent, PageHeader} from 'app/styles/organization';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {uniqueId} from 'app/utils/guid';
import space from 'app/styles/space';
import BuilderBreadCrumbs from 'app/views/alerts/builder/builderBreadCrumbs';
import EventView from 'app/utils/discover/eventView';
import IncidentRulesCreate from 'app/views/settings/incidentRules/create';
import IssueEditor from 'app/views/settings/projectAlerts/issueEditor';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import PageHeading from 'app/components/pageHeading';

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

class Create extends Component<Props, State> {
  state: State = {
    eventView: undefined,
    alertType: this.props.location.pathname.includes('/alerts/rules/')
      ? 'issue'
      : this.props.location.pathname.includes('/alerts/metric-rules/')
      ? 'metric'
      : null,
  };

  componentDidMount() {
    const {organization, location, project} = this.props;

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
    const {
      hasMetricAlerts,
      organization,
      project,
      params: {projectId},
    } = this.props;
    const {alertType, eventView} = this.state;

    const shouldShowAlertTypeChooser = hasMetricAlerts;
    const title = t('New Alert Rule');

    return (
      <Fragment>
        <SentryDocumentTitle title={title} objSlug={projectId} />
        <PageContent>
          <BuilderBreadCrumbs
            hasMetricAlerts={hasMetricAlerts}
            orgSlug={organization.slug}
            title={title}
          />
          <StyledPageHeader>
            <PageHeading>{title}</PageHeading>
          </StyledPageHeader>
          {shouldShowAlertTypeChooser && (
            <AlertTypeChooser
              organization={organization}
              selected={alertType}
              onChange={this.handleChangeAlertType}
            />
          )}

          {(!hasMetricAlerts || alertType === 'issue') && (
            <IssueEditor {...this.props} project={project} />
          )}

          {hasMetricAlerts && alertType === 'metric' && (
            <IncidentRulesCreate
              {...this.props}
              eventView={eventView}
              sessionId={this.sessionId}
              project={project}
            />
          )}
        </PageContent>
      </Fragment>
    );
  }
}

const StyledPageHeader = styled(PageHeader)`
  margin-bottom: ${space(4)};
`;

export default Create;
