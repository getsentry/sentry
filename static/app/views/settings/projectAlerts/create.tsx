import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'app/components/layouts/thirds';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {uniqueId} from 'app/utils/guid';
import BuilderBreadCrumbs from 'app/views/alerts/builder/builderBreadCrumbs';
import {
  AlertType as WizardAlertType,
  AlertWizardAlertNames,
  WizardRuleTemplate,
} from 'app/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'app/views/alerts/wizard/utils';
import IncidentRulesCreate from 'app/views/settings/incidentRules/create';
import IssueRuleEditor from 'app/views/settings/projectAlerts/issueRuleEditor';

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
  wizardTemplate?: WizardRuleTemplate;
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
    const {organization, location, project} = this.props;

    trackAnalyticsEvent({
      eventKey: 'new_alert_rule.viewed',
      eventName: 'New Alert Rule: Viewed',
      organization_id: organization.id,
      project_id: project.id,
      session_id: this.sessionId,
    });

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
      }
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
      location,
    } = this.props;
    const {alertType, eventView, wizardTemplate} = this.state;

    const hasWizard = organization.features.includes('alert-wizard');
    const shouldShowAlertTypeChooser = hasMetricAlerts && !hasWizard;
    let wizardAlertType: undefined | WizardAlertType;
    if (location?.query?.createFromWizard) {
      wizardAlertType = wizardTemplate
        ? getAlertTypeFromAggregateDataset(wizardTemplate)
        : 'issues';
    }

    const title = t('New Alert Rule');

    return (
      <React.Fragment>
        <SentryDocumentTitle title={title} projectSlug={projectId} />

        <Layout.Header>
          <Layout.HeaderContent>
            <BuilderBreadCrumbs
              hasMetricAlerts={hasMetricAlerts}
              orgSlug={organization.slug}
              alertName={wizardAlertType && AlertWizardAlertNames[wizardAlertType]}
              title={wizardAlertType ? t('Create Alert Rule') : title}
              projectSlug={projectId}
            />

            <Layout.Title>
              {wizardAlertType ? t('Set Alert Conditions') : title}
            </Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <AlertConditionsBody>
          <Layout.Main fullWidth>
            {shouldShowAlertTypeChooser && (
              <AlertTypeChooser
                organization={organization}
                selected={alertType}
                onChange={this.handleChangeAlertType}
              />
            )}

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
              />
            )}
          </Layout.Main>
        </AlertConditionsBody>
      </React.Fragment>
    );
  }
}

const AlertConditionsBody = styled(Layout.Body)`
  margin-bottom: -20px;

  * {
    max-width: 1000px;
  }
`;

export default Create;
