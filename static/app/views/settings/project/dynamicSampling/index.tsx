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

  if (
    organization.features.includes('server-side-sampling') &&
    (organization.features.includes('dynamic-sampling-opinionated') ||
      organization.features.includes('dynamic-sampling-basic'))
  ) {
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

  return <ServerSideSampling project={project} />;
}
