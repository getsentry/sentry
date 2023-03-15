import {RouteComponentProps} from 'react-router';

import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import ProjectSourceMapsList from 'sentry/views/settings/projectSourceMaps/list';
import {ProjectSourceMaps} from 'sentry/views/settings/projectSourceMaps/projectSourceMaps';

type Props = RouteComponentProps<{projectId: string}, {}> & {
  children: React.ReactNode;
  project: Project;
};

export function ProjectSourceMapsContainer(props: Props) {
  const organization = useOrganization();

  const sourceMapsDebugIds = organization.features.includes('source-maps-debug-ids');

  if (sourceMapsDebugIds) {
    return <ProjectSourceMaps {...props} />;
  }

  return <ProjectSourceMapsList {...props} organization={organization} />;
}
