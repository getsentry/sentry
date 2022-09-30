import {Organization, Project} from 'sentry/types';

type Props = {
  organization: Organization;
  projects: Project[];
};

export function DynamicSamplingAlert({organization}: Props) {
  const showAlert =
    organization.features.includes('server-side-sampling') &&
    organization.features.includes('organization:server-side-sampling-ui');
  return null;
}
