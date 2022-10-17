import Feature from 'sentry/components/acl/feature';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

import ServerSideSampling from '../server-side-sampling';

import {DynamicSampling} from './dynamicSampling';

type Props = {
  project: Project;
};

export default function DynamicSamplingContainer({project}: Props) {
  const organization = useOrganization();

  if (!organization.features.includes('dynamic-sampling-total-transaction-packaging')) {
    return <ServerSideSampling project={project} />;
  }

  return (
    <Feature
      features={['server-side-sampling', 'server-side-sampling-ui']}
      hookName="feature-disabled:dynamic-sampling-basic"
      organization={organization}
    >
      <DynamicSampling project={project} />
    </Feature>
  );
}
