import {Component, Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {uniqueId} from 'sentry/utils/guid';
import Teams from 'sentry/utils/teams';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';
import IncidentRulesCreate from 'sentry/views/alerts/incidentRules/create';
import IssueRuleEditor from 'sentry/views/alerts/issueRuleEditor';
import {
  AlertType as WizardAlertType,
  AlertWizardAlertNames,
  WizardRuleTemplate,
} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

type RouteParams = {
  orgId: string;
  projectId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  hasMetricAlerts: boolean;
  organization: Organization;
  project: Project;
};

type AlertType = 'metric' | 'issue';

type State = {
  alertType: AlertType;
};

class Create extends Component<Props, State> {
  state = this.getInitialState();

  getInitialState(): State {
    const {organization, location, project} = this.props;
    const {createFromDiscover, createFromWizard, aggregate, dataset, eventTypes} =
      location?.query ?? {};
    let alertType: AlertType = 'issue';

    // Alerts can only be created via create from discover or alert wizard
    if (createFromDiscover) {
      alertType = 'metric';
    } else if (createFromWizard) {
      if (aggregate && dataset && eventTypes) {
        alertType = 'metric';
      } else {
        // Just to be explicit
        alertType = 'issue';
      }
    } else {
      browserHistory.replace(
        `/organizations/${organization.slug}/alerts/${project.slug}/wizard`
      );
    }

    return {alertType};
  }

  componentDidMount() {
    const {organization, project} = this.props;
    trackAdvancedAnalyticsEvent('new_alert_rule.viewed', {
      organization,
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
    const {alertType} = this.state;
    const {aggregate, dataset, eventTypes, createFromWizard, createFromDiscover} =
      location?.query ?? {};
    const wizardTemplate: WizardRuleTemplate = {aggregate, dataset, eventTypes};
    const eventView = createFromDiscover ? EventView.fromLocation(location) : undefined;

    let wizardAlertType: undefined | WizardAlertType;
    if (createFromWizard && alertType === 'metric') {
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
          <StyledLayoutMain fullWidth>
            <Teams provideUserTeams>
              {({teams, initiallyLoaded}) =>
                initiallyLoaded ? (
                  <Fragment>
                    {(!hasMetricAlerts || alertType === 'issue') && (
                      <IssueRuleEditor
                        {...this.props}
                        project={project}
                        userTeamIds={teams.map(({id}) => id)}
                      />
                    )}

                    {hasMetricAlerts && alertType === 'metric' && (
                      <IncidentRulesCreate
                        {...this.props}
                        eventView={eventView}
                        wizardTemplate={wizardTemplate}
                        sessionId={this.sessionId}
                        project={project}
                        isCustomMetric={wizardAlertType === 'custom'}
                        userTeamIds={teams.map(({id}) => id)}
                      />
                    )}
                  </Fragment>
                ) : (
                  <LoadingIndicator />
                )
              }
            </Teams>
          </StyledLayoutMain>
        </AlertConditionsBody>
      </Fragment>
    );
  }
}

const AlertConditionsBody = styled(Layout.Body)`
  margin-bottom: -${space(3)};
`;

const StyledLayoutMain = styled(Layout.Main)`
  max-width: 1000px;
`;

const StyledHeaderContent = styled(Layout.HeaderContent)`
  overflow: visible;
`;

export default Create;
