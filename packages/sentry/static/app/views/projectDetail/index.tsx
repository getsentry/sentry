import withOrganization from 'sentry/utils/withOrganization';

import ProjectDetail from './projectDetail';

function ProjectDetailContainer(
  props: Omit<
    React.ComponentProps<typeof ProjectDetail>,
    'projects' | 'loadingProjects' | 'selection'
  >
) {
  return <ProjectDetail {...props} />;
}

export default withOrganization(ProjectDetailContainer);
