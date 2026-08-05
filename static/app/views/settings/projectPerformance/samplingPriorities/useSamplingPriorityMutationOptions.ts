import {useIsMutating} from '@tanstack/react-query';

import type {DetailedProject} from 'sentry/types/project';
import type {DynamicSamplingBiasType} from 'sentry/types/sampling';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getRetentionPriorityFields} from './retentionPrioritySettings';

export function useSamplingPriorityMutationOptions(project: DetailedProject) {
  const organization = useOrganization();
  const {mutateAsync: updateProject} = useUpdateProject(project);
  const priorityFields = getRetentionPriorityFields(organization);
  const mutationKey = ['project-sampling-priorities', project.id];
  const isUpdatingSamplingPriority = useIsMutating({mutationKey}) > 0;

  const isPriorityActive = (name: DynamicSamplingBiasType) =>
    project.dynamicSamplingBiases?.find(bias => bias.id === name)?.active ?? false;

  const getMutationOptions = (priorityName: DynamicSamplingBiasType) => ({
    mutationKey,
    mutationFn: (data: Record<string, boolean>) => {
      const updatedPriority = {
        id: priorityName,
        active: data[priorityName] ?? false,
      };
      const currentBiases = project.dynamicSamplingBiases ?? [];
      const hasCurrentPriority = currentBiases.some(bias => bias.id === priorityName);

      return updateProject({
        dynamicSamplingBiases: hasCurrentPriority
          ? currentBiases.map(bias => (bias.id === priorityName ? updatedPriority : bias))
          : [...currentBiases, updatedPriority],
      });
    },
    onSuccess: (_response: DetailedProject, variables: Record<string, boolean>) => {
      trackAnalytics(
        variables[priorityName]
          ? 'dynamic_sampling_settings.priority_enabled'
          : 'dynamic_sampling_settings.priority_disabled',
        {organization, project_id: project.id, id: priorityName}
      );
    },
  });

  return {
    getMutationOptions,
    isPriorityActive,
    isUpdatingSamplingPriority,
    priorityFields,
  };
}
