import Feature from 'sentry/components/acl/feature';

import ProjectPerformance from './projectPerformance';

export default function ProjectPerformanceContainer() {
  return (
    <Feature features="performance-view">
      <ProjectPerformance />
    </Feature>
  );
}
