import {Project} from 'sentry/types';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';

export function useCurrentProjectFromRouteParam(): Project | null {
  const params = useParams();
  const projects = useProjects({limit: 1, slugs: [params?.projectId]});
  return projects.projects?.[0] ?? null;
}
