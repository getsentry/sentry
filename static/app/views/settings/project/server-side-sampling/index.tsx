import Feature from 'sentry/components/acl/feature';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

import {ServerSideSampling} from './serverSideSampling';

type Props = {
  project: Project;
};

export default function ServerSideSamplingContainer({project}: Props) {
  const organization = useOrganization();

  return (
    <Feature
      requireAll={false}
      features={['dynamic-sampling-basic', 'server-side-sampling-ui']} // <-- the "server-side-sampling-ui" feature will be removed in the future
      hookName="feature-disabled:dynamic-sampling-basic"
      organization={organization}
      project={project}
    >
      <ServerSideSampling project={project} />
    </Feature>
  );
}
