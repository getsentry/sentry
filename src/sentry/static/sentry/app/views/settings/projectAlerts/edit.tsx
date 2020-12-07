import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import PageHeading from 'app/components/pageHeading';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {ALL_ENVIRONMENTS_KEY} from 'app/constants';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {UnsavedIssueAlertRule} from 'app/types/alerts';
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
} & AsyncView['state'];

const defaultRule: UnsavedIssueAlertRule = {
  actionMatch: 'all',
  filterMatch: 'all',
  actions: [],
  conditions: [],
  filters: [],
  name: '',
  frequency: 30,
  environment: ALL_ENVIRONMENTS_KEY,
};

class ProjectAlertsEditor extends AsyncView<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      alertType: '',
      rule: {...defaultRule},
    };
  }

  componentDidMount() {
    this.getRuleEndpoint();
  }

  getRuleEndpoint = async () => {
    const {location, params, organization, project} = this.props;

    const endpoint: string[] = [];

    if (location.pathname.includes('/alerts/metric-rules/')) {
      endpoint.push(`/organizations/${organization.slug}/alert-rules/${params.ruleId}/`);
    } else {
      endpoint.push(
        `/projects/${organization.slug}/${project.slug}/rules/${params.ruleId}/`
      );
    }
    try {
      const rule = await this.api.requestPromise(endpoint.toString(), {
        method: 'GET',
      });
      this.setState({
        rule,
      });
    } catch (err) {
      this.setState({
        detailedError: err.responseJSON || {__all__: 'Unknown error'},
      });
      addErrorMessage(t('An error occurred'));
    }
  };

  render() {
    const {hasMetricAlerts, location, params, organization, project} = this.props;
    const name = this.state.rule.name;
    const {rule} = this.state;
    const {projectId} = params;
    const alertType = location.pathname.includes('/alerts/metric-rules/')
      ? 'metric'
      : 'issue';

    const title = t(`Edit Alert Rule: ${name}`);

    return (
      <React.Fragment>
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
          {(!hasMetricAlerts || alertType === 'issue') && (
            <IssueEditor {...this.props} project={project} rule={rule} />
          )}
          {hasMetricAlerts && alertType === 'metric' && (
            <IncidentRulesDetails {...this.props} project={project} rule={rule} />
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
