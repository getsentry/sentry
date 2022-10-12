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
      features={['server-side-sampling', 'server-side-sampling-ui']}
      hookName="feature-disabled:dynamic-sampling-basic"
      organization={organization}
    >
      <ServerSideSampling project={project} />
    </Feature>
  );
}
