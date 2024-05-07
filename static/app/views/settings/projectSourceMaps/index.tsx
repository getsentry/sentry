import type {RouteComponentProps} from 'react-router';

import type {Project} from 'sentry/types/project';

import {ProjectSourceMaps} from './projectSourceMaps';
import {ProjectSourceMapsArtifacts} from './projectSourceMapsArtifacts';

type Props = RouteComponentProps<
  {orgId: string; projectId: string; bundleId?: string; name?: string},
  {}
> & {
  children: React.ReactNode;
  project: Project;
};

export default function ProjectSourceMapsContainer({params, location, ...props}: Props) {
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
