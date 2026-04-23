import {useMutation, useQueryClient} from '@tanstack/react-query';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {makeDetailedProjectQueryKey} from 'sentry/utils/project/useDetailedProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Variables extends Partial<Project> {}

type Context =
  | {
      previousProject: Project;
      error?: never;
    }
  | {
      error: Error;
      previousProject?: never;
    };

export function useUpdateProject(project: Project) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const queryKey = makeDetailedProjectQueryKey({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  return useMutation<Project, Error, Variables, Context>({
    onMutate: (data: Variables) => {
      const fromCache = queryClient.getQueryData<ApiResponse<Project>>(queryKey)?.json;
      const fromStore = ProjectsStore.getById(project.id);
      const fromProp = project;

      const isValidProjectWithOptions = (obj: unknown): obj is Project =>
        obj !== null &&
        typeof obj === 'object' &&
        typeof (obj as Project).options === 'object' &&
        (obj as Project).options !== null;

      const previousProject =
        (isValidProjectWithOptions(fromCache) ? fromCache : null) ||
        (isValidProjectWithOptions(fromStore) ? fromStore : null) ||
        fromProp;

      if (!previousProject) {
        return {error: new Error('Previous project not found')};
      }

      const updatedProject = {
        ...previousProject,
        ...data,
        options: data.options
          ? {
              ...previousProject.options,
              ...data.options,
            }
          : previousProject.options,
      };

      // Update caches optimistically
      ProjectsStore.onUpdateSuccess(updatedProject);
      queryClient.setQueryData<ApiResponse<Project>>(queryKey, prev => ({
        headers: prev?.headers ?? {},
        json: updatedProject,
      }));

      return {previousProject};
    },
    mutationFn: (data: Variables) => {
      return fetchMutation<Project>({
        method: 'PUT',
        url: `/projects/${organization.slug}/${project.slug}/`,
        data: {...data},
      });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProject) {
        ProjectsStore.onUpdateSuccess(context.previousProject);
        queryClient.setQueryData<ApiResponse<Project>>(queryKey, prev => ({
          headers: prev?.headers ?? {},
          json: context.previousProject,
        }));
      }
    },
    onSettled: () => {
      // Invalidate to refetch and ensure consistency for the queryCache
      // ProjectsStore should've been updated already. It could be out of sync if
      // there are multiple mutations in parallel.
      queryClient.invalidateQueries({queryKey});
    },
  });
}
