import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Project} from 'sentry/types/project';
import {DemoSourcemapsTourProvider} from 'sentry/utils/demoMode/demoTours';

import {SourceMapsDetails} from './sourceMapsDetails';
import {SourceMapsList} from './sourceMapsList';

type Props = RouteComponentProps<{
  orgId: string;
  projectId: string;
  bundleId?: string;
  name?: string;
}> & {
  children: React.ReactNode;
  project: Project;
};

export default function ProjectSourceMapsContainer({params, location, ...props}: Props) {
  // if (params.bundleId) {
  //   return (

  //   );
  // }

  return (
    <DemoSourcemapsTourProvider>
      {params.bundleId ? (
        <SourceMapsDetails
          {...props}
          location={location}
          params={{...params, bundleId: params.bundleId}}
        />
      ) : (
        <SourceMapsList
          {...props}
          location={location}
          params={{...params, bundleId: params.bundleId}}
        />
      )}
    </DemoSourcemapsTourProvider>
  );
}
