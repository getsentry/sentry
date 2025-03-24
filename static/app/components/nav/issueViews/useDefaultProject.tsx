import {useMemo} from 'react';

import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

export default function useDefaultProject(): number[] {
  const organization = useOrganization();
  const {projects: allProjects} = useProjects();

  const allowMultipleProjects = organization.features.includes('global-views');
  const isSuperUser = isActiveSuperuser();

  const memberProjects = useMemo(
    () => allProjects.filter(project => project.isMember),
    [allProjects]
  );

  return useMemo(() => {
    if (allowMultipleProjects) {
      return [];
    }

    if (isSuperUser) {
      // Return first project ID or empty array if no projects exist
      if (allProjects.length > 0 && allProjects[0]?.id) {
        return allowMultipleProjects ? [] : [parseInt(allProjects[0].id, 10)];
      }
      return [];
    }

    // Return first member project ID or empty array if no member projects exist
    if (memberProjects.length > 0 && memberProjects[0]?.id) {
      return [parseInt(memberProjects[0].id, 10)];
    }
    return [];
  }, [memberProjects, allowMultipleProjects, isSuperUser, allProjects]);
}
