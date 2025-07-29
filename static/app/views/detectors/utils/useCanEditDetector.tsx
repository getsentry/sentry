import {hasEveryAccess} from 'sentry/components/acl/access';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';

export function useCanEditDetector({projectId}: {projectId: string}) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: projectId});

  if (!project) {
    return false;
  }

  return hasEveryAccess(['alerts:write'], {organization, project});
}
