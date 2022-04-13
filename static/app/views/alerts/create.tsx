import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {uniqueId} from 'sentry/utils/guid';
import Teams from 'sentry/utils/teams';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';
import IncidentRulesCreate from 'sentry/views/alerts/incidentRules/create';
import IssueRuleEditor from 'sentry/views/alerts/issueRuleEditor';
import {AlertRuleType} from 'sentry/views/alerts/types';
import {
  AlertType as WizardAlertType,
  AlertWizardAlertNames,
  DEFAULT_WIZARD_TEMPLATE,
  WizardRuleTemplate,
} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

type RouteParams = {
  orgId: string;
  alertType?: AlertRuleType;
  projectId?: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  hasMetricAlerts: boolean;
  organization: Organization;
  project: Project;
};

type State = {
  alertType: AlertRuleType;
};

class Create extends Component<Props, State> {
  state = this.getInitialState();

  getInitialState(): State {
    const {organization, location, project, params, router} = this.props;
    const {
      createFromDiscover,
      createFromWizard,
      aggregate,
      dataset,
      eventTypes,
      createFromV3,
    } = location?.query ?? {};
    let alertType = AlertRuleType.ISSUE;

    const hasAlertWizardV3 = organization.features.includes('alert-wizard-v3');

    // Alerts can only be created via create from discover or alert wizard, until alert-wizard-v3 is fully implemented
    if (hasAlertWizardV3 && createFromV3) {
      alertType = params.alertType || AlertRuleType.METRIC;

      if (alertType === AlertRuleType.METRIC && !(aggregate && dataset && eventTypes)) {
        router.replace({
          ...location,
          pathname: `/organizations/${organization.slug}/alerts/new/${alertType}`,
          query: {
            ...location.query,
            ...DEFAULT_WIZARD_TEMPLATE,
            project: project.slug,
          },
        });
      }
    } else if (createFromDiscover) {
      alertType = AlertRuleType.METRIC;
    } else if (createFromWizard) {
      if (aggregate && dataset && eventTypes) {
        alertType = AlertRuleType.METRIC;
      } else {
        // Just to be explicit
        alertType = AlertRuleType.ISSUE;
      }
    } else {
      router.replace(`/organizations/${organization.slug}/alerts/${project.slug}/wizard`);
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
    const {hasMetricAlerts, organization, project, location, routes} = this.props;
    const {alertType} = this.state;
    const {aggregate, dataset, eventTypes, createFromWizard, createFromDiscover} =
      location?.query ?? {};
    const wizardTemplate: WizardRuleTemplate = {
      aggregate: aggregate ?? DEFAULT_WIZARD_TEMPLATE.aggregate,
      dataset: dataset ?? DEFAULT_WIZARD_TEMPLATE.dataset,
      eventTypes: eventTypes ?? DEFAULT_WIZARD_TEMPLATE.eventTypes,
    };
    const eventView = createFromDiscover ? EventView.fromLocation(location) : undefined;

    let wizardAlertType: undefined | WizardAlertType;
    if (createFromWizard && alertType === AlertRuleType.METRIC) {
      wizardAlertType = wizardTemplate
        ? getAlertTypeFromAggregateDataset(wizardTemplate)
        : 'issues';
    }

    const title = t('New Alert Rule');

    return (
      <Fragment>
        <SentryDocumentTitle title={title} projectSlug={project.slug} />

        <Layout.Header>
          <StyledHeaderContent>
            <BuilderBreadCrumbs
              organization={organization}
              alertName={t('Set Conditions')}
              title={wizardAlertType ? t('Select Alert') : title}
              projectSlug={project.slug}
              alertType={alertType}
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
        <Layout.Body>
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

                    {hasMetricAlerts && alertType === AlertRuleType.METRIC && (
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
        </Layout.Body>
      </Fragment>
    );
  }
}

const StyledLayoutMain = styled(Layout.Main)`
  max-width: 1000px;
`;

const StyledHeaderContent = styled(Layout.HeaderContent)`
  overflow: visible;
`;

export default Create;
