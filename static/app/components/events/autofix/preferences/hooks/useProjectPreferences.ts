import type {ProjectPreferences} from 'sentry/components/events/autofix/types';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useProjectPreferences(project: Project) {
  const organization = useOrganization();

  const {data, ...rest} = useApiQuery<{preference: ProjectPreferences}>(
    [`/projects/${organization.slug}/${project.slug}/seer/preferences/`],
    {
      staleTime: 60000, // 1 minute
    }
  );

  return {
    data: data?.preference,
    ...rest,
  };
}
