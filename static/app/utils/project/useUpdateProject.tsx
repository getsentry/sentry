import {mutationOptions, useMutation, useQueryClient} from '@tanstack/react-query';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {DetailedProject, Project} from 'sentry/types/project';
import {makeDetailedProjectQueryKey} from 'sentry/utils/project/useDetailedProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

type ProjectWithOptions = Project & {
  // ProjectSummary does not include options, but cached detailed projects can.
  options?: DetailedProject['options'];
};

function isValidProjectWithOptions(
  project?: ProjectWithOptions
): project is ProjectWithOptions {
  return (
    project !== undefined &&
    'options' in project &&
    project.options !== null &&
    project.options !== undefined
  );
}

function isDetailedProject(
  project?: Project | DetailedProject
): project is DetailedProject {
  return (
    project !== undefined &&
    // Check for properties that are exclusive to DetailedProject
    ('allowedDomains' in project || 'relayPiiConfig' in project)
  );
}

export function useUpdateProjectMutationOptions(project: Project) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const queryKey = makeDetailedProjectQueryKey({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  return mutationOptions({
    mutationFn: (data: Partial<DetailedProject>) => {
      return fetchMutation<DetailedProject>({
        method: 'PUT',
        url: `/projects/${organization.slug}/${project.slug}/`,
        data: {...data},
      });
    },
    onMutate: data => {
      // A slug change re-keys the detailed-project query and triggers URL
      // canonicalization (see projectRouteContext's redirect effect). An
      // optimistic write would flip the cached slug before the server confirms
      // it — popping the "project moved" redirect and masking backend errors
      // (e.g. a duplicate slug). Only update optimistically when the slug is
      // unchanged; for slug changes we wait for the server response.
      if (data.slug !== undefined && data.slug !== project.slug) {
        return;
      }

      const previousCachedDetailedProject = queryClient.getQueryData(queryKey)?.json;
      const storeProject = ProjectsStore.getById(project.id);

      // Legacy behavior: ProjectsStore is typed as Project summaries, but update
      // flows have historically written detailed project responses into it. Keep
      // using that for optimistic store updates, but only seed the detailed query
      // cache from objects that actually have detailed-project fields.
      const previousDetailedProject =
        previousCachedDetailedProject ||
        (isDetailedProject(storeProject) ? storeProject : undefined) ||
        (isDetailedProject(project) ? project : undefined);

      const previousProject: ProjectWithOptions =
        (isValidProjectWithOptions(previousDetailedProject)
          ? previousDetailedProject
          : null) ||
        (isValidProjectWithOptions(storeProject) ? storeProject : null) ||
        project;

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
      if (previousDetailedProject) {
        const updatedDetailedProject = {
          ...previousDetailedProject,
          ...data,
          options: data.options
            ? {
                ...previousDetailedProject.options,
                ...data.options,
              }
            : previousDetailedProject.options,
        };

        queryClient.setQueryData(queryKey, prev =>
          prev
            ? {...prev, json: updatedDetailedProject}
            : {headers: {}, json: updatedDetailedProject}
        );
      }

      return {previousProject, previousDetailedProject};
    },
    onSuccess: updatedProject => {
      ProjectsStore.onUpdateSuccess(updatedProject);
      queryClient.setQueryData(queryKey, prev =>
        prev ? {...prev, json: updatedProject} : {headers: {}, json: updatedProject}
      );
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProject) {
        ProjectsStore.onUpdateSuccess(context.previousProject);
        const previousDetailedProject = context.previousDetailedProject;
        if (previousDetailedProject) {
          queryClient.setQueryData(queryKey, prev =>
            prev ? {...prev, json: previousDetailedProject} : prev
          );
        }
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

export function useUpdateProject(project: Project) {
  const updateProjectMutationOptions = useUpdateProjectMutationOptions(project);

  return useMutation(updateProjectMutationOptions);
}
