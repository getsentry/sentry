import {useEffect} from 'react';
import {RouteComponentProps} from 'react-router';

import {fetchProjectDetails} from 'sentry/actionCreators/project';
import {PageFilters} from 'sentry/types';
import {analytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import withPageFilters from 'sentry/utils/withPageFilters';

import GroupDetails from './groupDetails';

type Props = {
  children: React.ReactNode;
  isGlobalSelectionReady: boolean;
  selection: PageFilters;
} & RouteComponentProps<{groupId: string}, {}>;

const IssueDetailsContainer = ({selection, ...props}: Props) => {
  const organization = useOrganization();
  const {projects} = useProjects();
  const api = useApi();

  const {params, location} = props;

  const projectId = location.query.project;
  const project = projects.find(proj => proj.id === projectId);

  useEffect(() => {
    if (!project?.slug) {
      return;
    }

    fetchProjectDetails({api, orgSlug: organization.slug, projSlug: project.slug});
  }, [api, organization.slug, project?.slug]);

  useEffect(() => {
    analytics('issue_page.viewed', {
      group_id: parseInt(params.groupId, 10),
      org_id: parseInt(organization.id, 10),
    });
  }, [organization, params.groupId]);

  return (
    <GroupDetails
      key={`${params.groupId}-envs:${selection.environments.join(',')}`}
      environments={selection.environments}
      organization={organization}
      projects={projects}
      {...props}
    />
  );
};

export default withPageFilters(IssueDetailsContainer);
