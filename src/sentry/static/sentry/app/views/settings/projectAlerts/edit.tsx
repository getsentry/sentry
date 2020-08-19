import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import {Organization, Project} from 'app/types';
import {PageContent, PageHeader} from 'app/styles/organization';
import {t} from 'app/locale';
import space from 'app/styles/space';
import BuilderBreadCrumbs from 'app/views/alerts/builder/builderBreadCrumbs';
import IncidentRulesDetails from 'app/views/settings/incidentRules/details';
import IssueEditor from 'app/views/settings/projectAlerts/issueEditor';
import PageHeading from 'app/components/pageHeading';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';

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

function ProjectAlertsEditor(props: Props) {
  const {hasMetricAlerts, location, params, organization, project} = props;
  const {projectId} = params;
  const alertType = location.pathname.includes('/alerts/metric-rules/')
    ? 'metric'
    : 'issue';
  const title = t('Edit Alert Rule');

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
          <IssueEditor {...props} project={project} />
        )}

        {hasMetricAlerts && alertType === 'metric' && (
          <IncidentRulesDetails {...props} project={project} />
        )}
      </PageContent>
    </React.Fragment>
  );
}

const StyledPageHeader = styled(PageHeader)`
  margin-bottom: ${space(4)};
`;

export default ProjectAlertsEditor;
