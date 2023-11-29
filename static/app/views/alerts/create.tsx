import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Member, Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {uniqueId} from 'sentry/utils/guid';
import withRouteAnalytics, {
  WithRouteAnalyticsProps,
} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import Teams from 'sentry/utils/teams';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';
import IssueRuleEditor from 'sentry/views/alerts/rules/issue';
import MetricRulesCreate from 'sentry/views/alerts/rules/metric/create';
import MetricRuleDuplicate from 'sentry/views/alerts/rules/metric/duplicate';
import {AlertRuleType} from 'sentry/views/alerts/types';
import {
  AlertType as WizardAlertType,
  AlertWizardAlertNames,
  DEFAULT_WIZARD_TEMPLATE,
  WizardRuleTemplate,
} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

type RouteParams = {
  alertType?: AlertRuleType;
  projectId?: string;
};

type Props = RouteComponentProps<RouteParams, {}> &
  WithRouteAnalyticsProps & {
    hasMetricAlerts: boolean;
    members: Member[] | undefined;
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
    const {aggregate, dataset, eventTypes, createFromDuplicate} = location?.query ?? {};
    const alertType = params.alertType || AlertRuleType.METRIC;

    // TODO(taylangocmen): Remove redirect with aggregate && dataset && eventTypes, init from template
    if (
      alertType === AlertRuleType.METRIC &&
      !(aggregate && dataset && eventTypes) &&
      !createFromDuplicate
    ) {
      router.replace(
        normalizeUrl({
          ...location,
          pathname: `/organizations/${organization.slug}/alerts/new/${alertType}`,
          query: {
            ...location.query,
            ...DEFAULT_WIZARD_TEMPLATE,
            project: project.slug,
          },
        })
      );
    }

    return {alertType};
  }

  componentDidMount() {
    const {project} = this.props;

    this.props.setRouteAnalyticsParams({
      project_id: project.id,
      session_id: this.sessionId,
      alert_type: this.state.alertType,
      duplicate_rule: this.isDuplicateRule ? 'true' : 'false',
      wizard_v3: 'true',
    });
    this.props.setEventNames('new_alert_rule.viewed', 'New Alert Rule: Viewed');
  }

  /** Used to track analytics within one visit to the creation page */
  sessionId = uniqueId();

  get isDuplicateRule(): boolean {
    const {location} = this.props;
    const createFromDuplicate = location?.query.createFromDuplicate === 'true';
    return createFromDuplicate && location?.query.duplicateRuleId;
  }

  render() {
    const {hasMetricAlerts, organization, project, location, members} = this.props;
    const {alertType} = this.state;
    const {aggregate, dataset, eventTypes, createFromWizard, createFromDiscover, query} =
      location?.query ?? {};
    const wizardTemplate: WizardRuleTemplate = {
      aggregate: aggregate ?? DEFAULT_WIZARD_TEMPLATE.aggregate,
      dataset: dataset ?? DEFAULT_WIZARD_TEMPLATE.dataset,
      eventTypes: eventTypes ?? DEFAULT_WIZARD_TEMPLATE.eventTypes,
      query: query ?? DEFAULT_WIZARD_TEMPLATE.query,
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
          <Layout.HeaderContent>
            <BuilderBreadCrumbs
              organization={organization}
              alertName={t('Set Conditions')}
              title={wizardAlertType ? t('Select Alert') : title}
              projectSlug={project.slug}
            />
            <Layout.Title>
              {wizardAlertType
                ? `${t('Set Conditions for')} ${AlertWizardAlertNames[wizardAlertType]}`
                : title}
            </Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Teams provideUserTeams>
            {({teams, initiallyLoaded}) =>
              initiallyLoaded ? (
                <Fragment>
                  {(!hasMetricAlerts || alertType === AlertRuleType.ISSUE) && (
                    <IssueRuleEditor
                      {...this.props}
                      project={project}
                      userTeamIds={teams.map(({id}) => id)}
                      members={members}
                    />
                  )}

                  {hasMetricAlerts &&
                    alertType === AlertRuleType.METRIC &&
                    (this.isDuplicateRule ? (
                      <MetricRuleDuplicate
                        {...this.props}
                        eventView={eventView}
                        wizardTemplate={wizardTemplate}
                        sessionId={this.sessionId}
                        project={project}
                        userTeamIds={teams.map(({id}) => id)}
                      />
                    ) : (
                      <MetricRulesCreate
                        {...this.props}
                        eventView={eventView}
                        wizardTemplate={wizardTemplate}
                        sessionId={this.sessionId}
                        project={project}
                        userTeamIds={teams.map(({id}) => id)}
                      />
                    ))}
                </Fragment>
              ) : (
                <LoadingIndicator />
              )
            }
          </Teams>
        </Layout.Body>
      </Fragment>
    );
  }
}

export default withRouteAnalytics(Create);
