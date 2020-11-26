import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import PageHeading from 'app/components/pageHeading';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import BuilderBreadCrumbs from 'app/views/alerts/builder/builderBreadCrumbs';
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
};

type State = {
  alertName: string;
};

class ProjectAlertsEditor extends React.Component<Props, State> {
  state = {
    alertName: '',
  };

  componentDidMount() {
    this.waitForInput();
  }

  getAlertName() {
    const alertName = document
      .querySelector<HTMLInputElement>('input[name="name"]')!
      .getAttribute('value');
    if (alertName) {
      this.setState({
        alertName,
      });
    } else {
      setTimeout(this.getAlertName.bind(this), 0);
    }
    return null;
  }

  getMetricName() {
    const alertName = document.body.querySelector<HTMLInputElement>(
      'input[label="Rule Name"]'
    );
    if (alertName) {
      this.setState({
        alertName: alertName.value,
      });
    } else {
      setTimeout(this.getMetricName.bind(this), 0);
    }
    return null;
  }

  waitForInput() {
    const alertType = location.pathname.includes('/alerts/metric-rules/')
      ? 'metric'
      : 'issue';
    if (alertType === 'metric') {
      this.getMetricName();
    } else {
      this.getAlertName();
    }
  }

  render() {
    const {hasMetricAlerts, params, location, organization, project} = this.props;
    const alertType = location.pathname.includes('/alerts/metric-rules/')
      ? 'metric'
      : 'issue';
    const name = this.state ? this.state.alertName : '';
    const {projectId} = params;

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
            <IssueEditor {...this.props} project={project} />
          )}
          {hasMetricAlerts && alertType === 'metric' && (
            <IncidentRulesDetails {...this.props} project={project} />
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
