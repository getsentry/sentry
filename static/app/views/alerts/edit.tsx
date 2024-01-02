import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Member, Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import Teams from 'sentry/utils/teams';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';
import IssueEditor from 'sentry/views/alerts/rules/issue';
import MetricRulesEdit from 'sentry/views/alerts/rules/metric/edit';
import {AlertRuleType} from 'sentry/views/alerts/types';

type RouteParams = {
  projectId: string;
  ruleId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  hasMetricAlerts: boolean;
  members: Member[] | undefined;
  organization: Organization;
  project: Project;
};

type State = {
  ruleName: string;
};

class ProjectAlertsEditor extends Component<Props, State> {
  state: State = {
    ruleName: '',
  };

  componentDidMount() {
    const {organization, project} = this.props;
    trackAnalytics('edit_alert_rule.viewed', {
      organization,
      project_id: project.id,
      alert_type: this.getAlertType(),
    });
  }

  handleChangeTitle = (ruleName: string) => {
    this.setState({ruleName});
  };

  getTitle() {
    const {ruleName} = this.state;
    return `${ruleName}`;
  }

  getAlertType(): AlertRuleType {
    return location.pathname.includes('/alerts/metric-rules/')
      ? AlertRuleType.METRIC
      : AlertRuleType.ISSUE;
  }

  render() {
    const {hasMetricAlerts, organization, project, members, location} = this.props;
    const alertType = this.getAlertType();

    // TODO(telemetry-experience): Remove once the migration is complete
    const isMigration = location?.query?.migration === '1';

    return (
      <Fragment>
        <SentryDocumentTitle
          title={this.getTitle()}
          orgSlug={organization.slug}
          projectSlug={project.slug}
        />
        <Layout.Header>
          <Layout.HeaderContent>
            <BuilderBreadCrumbs
              organization={organization}
              title={isMigration ? t('Review Thresholds') : t('Edit Alert Rule')}
              projectSlug={project.slug}
            />
            <Layout.Title>{this.getTitle()}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Teams provideUserTeams>
            {({teams, initiallyLoaded}) =>
              initiallyLoaded ? (
                <Fragment>
                  {(!hasMetricAlerts || alertType === AlertRuleType.ISSUE) && (
                    <IssueEditor
                      {...this.props}
                      project={project}
                      onChangeTitle={this.handleChangeTitle}
                      userTeamIds={teams.map(({id}) => id)}
                      members={members}
                    />
                  )}
                  {hasMetricAlerts && alertType === AlertRuleType.METRIC && (
                    <MetricRulesEdit
                      {...this.props}
                      project={project}
                      onChangeTitle={this.handleChangeTitle}
                      userTeamIds={teams.map(({id}) => id)}
                    />
                  )}
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

export default ProjectAlertsEditor;
