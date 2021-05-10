import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'app/components/layouts/thirds';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import BuilderBreadCrumbs from 'app/views/alerts/builder/builderBreadCrumbs';
import IncidentRulesDetails from 'app/views/settings/incidentRules/details';
import IssueEditor from 'app/views/settings/projectAlerts/issueRuleEditor';

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
  alertType: string;
  ruleName: string;
};

class ProjectAlertsEditor extends Component<Props, State> {
  state: State = {
    alertType: '',
    ruleName: '',
  };

  handleChangeTitle = ruleName => {
    this.setState({ruleName});
  };

  getTitle() {
    const {ruleName} = this.state;
    return `${ruleName}`;
  }

  render() {
    const {hasMetricAlerts, location, organization, project} = this.props;

    const alertType = location.pathname.includes('/alerts/metric-rules/')
      ? 'metric'
      : 'issue';

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
              hasMetricAlerts={hasMetricAlerts}
              orgSlug={organization.slug}
              title={t('Edit Alert Rule')}
              projectSlug={project.slug}
            />
            <Layout.Title>{this.getTitle()}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <EditConditionsBody>
          <Layout.Main fullWidth>
            {(!hasMetricAlerts || alertType === 'issue') && (
              <IssueEditor
                {...this.props}
                project={project}
                onChangeTitle={this.handleChangeTitle}
              />
            )}
            {hasMetricAlerts && alertType === 'metric' && (
              <IncidentRulesDetails
                {...this.props}
                project={project}
                onChangeTitle={this.handleChangeTitle}
              />
            )}
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
