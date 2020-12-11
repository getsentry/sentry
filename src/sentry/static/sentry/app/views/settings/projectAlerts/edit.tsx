import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import PageHeading from 'app/components/pageHeading';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import BuilderBreadCrumbs from 'app/views/alerts/builder/builderBreadCrumbs';
import AsyncView from 'app/views/asyncView';
import IncidentRulesDetails from 'app/views/settings/incidentRules/details';
import IssueEditor from 'app/views/settings/projectAlerts/issueEditor';

type RouteParams = {
  orgId: string;
  projectId: string;
  ruleId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
  hasMetricAlerts: boolean;
} & AsyncView['props'];

type State = {
  alertType: string;
  ruleName: string;
} & AsyncView['state'];

class ProjectAlertsEditor extends AsyncView<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      alertType: '',
      ruleName: '',
    };
  }

  handleChangeTitle = ruleName => {
    this.setState({ruleName});
  };

  getTitle() {
    const {ruleName} = this.state;
    const defaultTitle = t('Edit Alert Rule');

    const title = `${ruleName}`;

    if (!ruleName) {
      return defaultTitle;
    }
    return `${defaultTitle}: ${title}`;
  }

  render() {
    const {hasMetricAlerts, location, params, organization, project} = this.props;
    const {projectId} = params;
    const alertType = location.pathname.includes('/alerts/metric-rules/')
      ? 'metric'
      : 'issue';

    return (
      <React.Fragment>
        <SentryDocumentTitle title={this.getTitle()} objSlug={projectId} />
        <PageContent>
          <BuilderBreadCrumbs
            hasMetricAlerts={hasMetricAlerts}
            orgSlug={organization.slug}
            title={this.getTitle()}
          />
          <StyledPageHeader>
            <PageHeading>{this.getTitle()}</PageHeading>
          </StyledPageHeader>
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
        </PageContent>
      </React.Fragment>
    );
  }
}

const StyledPageHeader = styled(PageHeader)`
  margin-bottom: ${space(4)};
`;

export default ProjectAlertsEditor;
