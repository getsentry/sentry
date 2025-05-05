import Feature from 'sentry/components/acl/feature';

import ProjectPerformance from './projectPerformance';

function ProjectPerformanceContainer() {
  return (
    <Feature features="performance-view">
      <ProjectPerformance />
    </Feature>
  );
}

export default ProjectPerformanceContainer;
