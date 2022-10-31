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
    organization.features.includes('dynamic-sampling')
  ) {
    return <DynamicSampling project={project} />;
  }

  return <ServerSideSampling project={project} />;
}
