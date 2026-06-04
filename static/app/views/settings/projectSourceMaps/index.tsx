import {useParams} from 'sentry/utils/useParams';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {SourceMapsDetails} from './sourceMapsDetails';
import {SourceMapsList} from './sourceMapsList';

export default function ProjectSourceMapsContainer() {
  const {project} = useProjectSettingsOutlet();
  const params = useParams<{orgId: string; projectId: string; bundleId?: string}>();

  if (params.bundleId) {
    return <SourceMapsDetails bundleId={params.bundleId} project={project} />;
  }

  return <SourceMapsList project={project} />;
}
