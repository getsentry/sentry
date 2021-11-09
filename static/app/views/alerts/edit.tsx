import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'app/components/layouts/thirds';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import Teams from 'app/utils/teams';
import BuilderBreadCrumbs from 'app/views/alerts/builder/builderBreadCrumbs';
import IncidentRulesDetails from 'app/views/alerts/incidentRules/details';
import IssueEditor from 'app/views/alerts/issueRuleEditor';

type RouteParams = {
  orgId: string;
  projectId: string;
  ruleId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
  hasMetricAlerts: boolean;
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

    trackAnalyticsEvent({
      eventKey: 'edit_alert_rule.viewed',
      eventName: 'Edit Alert Rule: Viewed',
      organization_id: organization.id,
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

  getAlertType(): 'metric' | 'issue' {
    return location.pathname.includes('/alerts/metric-rules/') ? 'metric' : 'issue';
  }

  render() {
    const {hasMetricAlerts, location, organization, project, routes} = this.props;
    const alertType = this.getAlertType();

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
              orgSlug={organization.slug}
              title={t('Edit Alert Rule')}
              projectSlug={project.slug}
              routes={routes}
              location={location}
            />
            <Layout.Title>{this.getTitle()}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <EditConditionsBody>
          <Layout.Main fullWidth>
            <Teams provideUserTeams>
              {({teams, initiallyLoaded}) =>
                initiallyLoaded ? (
                  <Fragment>
                    {(!hasMetricAlerts || alertType === 'issue') && (
                      <IssueEditor
                        {...this.props}
                        project={project}
                        onChangeTitle={this.handleChangeTitle}
                        userTeamIds={teams.map(({id}) => id)}
                      />
                    )}
                    {hasMetricAlerts && alertType === 'metric' && (
                      <IncidentRulesDetails
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
          </Layout.Main>
        </EditConditionsBody>
      </Fragment>
    );
  }
}

const EditConditionsBody = styled(Layout.Body)`
  margin-bottom: -${space(3)};

  *:not(img) {
    max-width: 1000px;
  }
`;

export default ProjectAlertsEditor;
