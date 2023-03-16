import {RouteComponentProps} from 'react-router';

import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import ProjectSourceMapsDetail from 'sentry/views/settings/projectSourceMaps/detail';
import ProjectSourceMapsList from 'sentry/views/settings/projectSourceMaps/list';

import {ProjectSourceMaps} from './projectSourceMaps';
import {ProjectSourceMapsArtifacts} from './projectSourceMapsArtifacts';

type Props = RouteComponentProps<
  {orgId: string; projectId: string; bundleId?: string; name?: string},
  {}
> & {
  children: React.ReactNode;
  project: Project;
};

export function ProjectSourceMapsContainer({params, location, ...props}: Props) {
  const organization = useOrganization();
  const sourceMapsDebugIds = organization.features.includes('source-maps-debug-ids');

  if (!sourceMapsDebugIds) {
    if (params.name) {
      return (
        <ProjectSourceMapsDetail
          {...props}
          location={location}
          params={{...params, name: params.name}}
          organization={organization}
        />
      );
    }
    return (
      <ProjectSourceMapsList
        {...props}
        location={location}
        params={params}
        organization={organization}
      />
    );
  }

  if (params.bundleId) {
    return (
      <ProjectSourceMapsArtifacts
        {...props}
        location={location}
        params={{...params, bundleId: params.bundleId}}
      />
    );
  }

  return <ProjectSourceMaps {...props} location={location} params={params} />;
}
