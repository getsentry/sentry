import {Component, Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'app/components/layouts/thirds';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {uniqueId} from 'app/utils/guid';
import BuilderBreadCrumbs from 'app/views/alerts/builder/builderBreadCrumbs';
import IncidentRulesCreate from 'app/views/alerts/incidentRules/create';
import IssueRuleEditor from 'app/views/alerts/issueRuleEditor';
import {
  AlertType as WizardAlertType,
  AlertWizardAlertNames,
  WizardRuleTemplate,
} from 'app/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'app/views/alerts/wizard/utils';

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
  wizardTemplate?: WizardRuleTemplate;
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

    if (location?.query) {
      const {query} = location;
      const {createFromDiscover, createFromWizard} = query;
      if (createFromDiscover) {
        const eventView = EventView.fromLocation(location);
        // eslint-disable-next-line react/no-did-mount-set-state
        this.setState({alertType: 'metric', eventView});
      } else if (createFromWizard) {
        const {aggregate, dataset, eventTypes} = query;
        if (aggregate && dataset && eventTypes) {
          // eslint-disable-next-line react/no-did-mount-set-state
          this.setState({
            alertType: 'metric',
            wizardTemplate: {aggregate, dataset, eventTypes},
          });
        } else {
          // eslint-disable-next-line react/no-did-mount-set-state
          this.setState({
            alertType: 'issue',
          });
        }
      } else {
        browserHistory.replace(
          `/organizations/${organization.slug}/alerts/${project.id}/wizard`
        );
      }
    }

    trackAnalyticsEvent({
      eventKey: 'new_alert_rule.viewed',
      eventName: 'New Alert Rule: Viewed',
      organization_id: organization.id,
      project_id: project.id,
      session_id: this.sessionId,
      alert_type: this.state.alertType,
    });
  }

  /** Used to track analytics within one visit to the creation page */
  sessionId = uniqueId();

  render() {
    const {
      hasMetricAlerts,
      organization,
      project,
      params: {projectId},
      location,
      routes,
    } = this.props;
    const {alertType, eventView, wizardTemplate} = this.state;

    let wizardAlertType: undefined | WizardAlertType;
    if (location?.query?.createFromWizard) {
      wizardAlertType = wizardTemplate
        ? getAlertTypeFromAggregateDataset(wizardTemplate)
        : 'issues';
    }

    const title = t('New Alert Rule');

    return (
      <Fragment>
        <SentryDocumentTitle title={title} projectSlug={projectId} />

        <Layout.Header>
          <StyledHeaderContent>
            <BuilderBreadCrumbs
              hasMetricAlerts={hasMetricAlerts}
              orgSlug={organization.slug}
              alertName={t('Set Conditions')}
              title={wizardAlertType ? t('Select Alert') : title}
              projectSlug={projectId}
              routes={routes}
              location={location}
              canChangeProject
            />
            <Layout.Title>
              {wizardAlertType
                ? `${t('Set Conditions for')} ${AlertWizardAlertNames[wizardAlertType]}`
                : title}
            </Layout.Title>
          </StyledHeaderContent>
        </Layout.Header>
        <AlertConditionsBody>
          <Layout.Main fullWidth>
            {(!hasMetricAlerts || alertType === 'issue') && (
              <IssueRuleEditor {...this.props} project={project} />
            )}

            {hasMetricAlerts && alertType === 'metric' && (
              <IncidentRulesCreate
                {...this.props}
                eventView={eventView}
                wizardTemplate={wizardTemplate}
                sessionId={this.sessionId}
                project={project}
                isCustomMetric={wizardAlertType === 'custom'}
              />
            )}
          </Layout.Main>
        </AlertConditionsBody>
      </Fragment>
    );
  }
}

const AlertConditionsBody = styled(Layout.Body)`
  margin-bottom: -${space(3)};

  *:not(img) {
    max-width: 1000px;
  }
`;

const StyledHeaderContent = styled(Layout.HeaderContent)`
  overflow: visible;
`;

export default Create;
