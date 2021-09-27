import NoProjectMessage from 'app/components/noProjectMessage';
import {Organization, Project} from 'app/types';
import withProjects from 'app/utils/withProjects';

type Props = {
  organization: Organization;
  projects: Project[];
  loadingProjects: boolean;
};

function LightWeightNoProjectMessage({
  organization,
  projects,
  loadingProjects,
  ...props
}: Props) {
  return (
    <NoProjectMessage
      {...props}
      organization={organization}
      projects={projects}
      loadingProjects={!('projects' in organization) && loadingProjects}
    />
  );
}

export default withProjects(LightWeightNoProjectMessage);
