import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {
  fetchMutation,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import {makeDetailedProjectQueryKey} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';

interface UpdateProjectAutomationData {
  autofixAutomationTuning: 'off' | 'super_low' | 'low' | 'medium' | 'high' | 'always';
  seerScannerAutomation: boolean;
}

export function useUpdateProjectAutomation(project: Project) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useMutation<Project, Error, UpdateProjectAutomationData>({
    mutationFn: (data: UpdateProjectAutomationData) => {
      return fetchMutation<Project>({
        method: 'PUT',
        url: `/projects/${organization.slug}/${project.slug}/`,
        data: {
          autofixAutomationTuning: data.autofixAutomationTuning,
          seerScannerAutomation: data.seerScannerAutomation,
        },
      });
    },
    onSuccess: (updatedProject: Project) => {
      // Update the project store so the UI reflects the changes immediately
      ProjectsStore.onUpdateSuccess(updatedProject);

      // Update the query cache optimistically
      setApiQueryData<Project>(
        queryClient,
        makeDetailedProjectQueryKey({
          orgSlug: organization.slug,
          projectSlug: project.slug,
        }),
        existingData => (updatedProject ? updatedProject : existingData)
      );

      // Invalidate to refetch and ensure consistency
      queryClient.invalidateQueries({
        queryKey: makeDetailedProjectQueryKey({
          orgSlug: organization.slug,
          projectSlug: project.slug,
        }),
      });
    },
  });
}
