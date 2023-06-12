import {useEffect} from 'react';
import {RouteComponentProps} from 'react-router';

import {fetchProjectDetails} from 'sentry/actionCreators/project';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import GroupDetails from './groupDetails';

type Props = {
  children: React.ReactNode;
} & RouteComponentProps<{groupId: string}, {}>;

function IssueDetailsContainer(props: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const api = useApi();

  const {location} = props;

  const projectId = location.query.project;
  const project = projects.find(proj => proj.id === projectId);

  useEffect(() => {
    if (!project?.slug) {
      return;
    }

    fetchProjectDetails({api, orgSlug: organization.slug, projSlug: project.slug});
  }, [api, organization.slug, project?.slug]);

  return <GroupDetails organization={organization} projects={projects} {...props} />;
}

export default IssueDetailsContainer;
