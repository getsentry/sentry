import {useCallback, useMemo} from 'react';

import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import useFetchSequentialPages from 'sentry/utils/api/useFetchSequentialPages';
import {
  fetchMutation,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

type AutofixAutomationTuning =
  | 'off'
  | 'super_low' // deprecated
  | 'low' // deprecated
  | 'medium'
  | 'high' // deprecated
  | 'always' // deprecated
  | null; // deprecated

// Mirrors the backend SeerRepoDefinition type
export interface BackendRepository {
  external_id: string;
  integration_id: string;
  name: string;
  organization_id: number;
  owner: string;
  provider: string;
  base_commit_sha?: string;
  branch_name?: string;
  branch_overrides?: Array<{
    branch_name: string;
    tag_name: string;
    tag_value: string;
  }>;
  instructions?: string;
  provider_raw?: string;
}

export type AutofixAutomationSettings = {
  autofixAutomationTuning: AutofixAutomationTuning;
  automatedRunStoppingPoint: ProjectSeerPreferences['automated_run_stopping_point'];
  automationHandoff: ProjectSeerPreferences['automation_handoff'];
  projectId: string;
  reposCount: number;
};

/**
 * Fetch all autofix related settings for all projects.
 *
 * This returns a list of objects with the following properties:
 * - projectId: the project ID
 * - autofixAutomationTuning: the tuning setting for automated autofix
 * - automatedRunStoppingPoint: the stopping point for automated runs
 * - reposCount: the number of repositories configured for the project
 */
export function useGetBulkAutofixAutomationSettings() {
  const organization = useOrganization();

  return useFetchSequentialPages<AutofixAutomationSettings[]>({
    enabled: true,
    perPage: 100,
    getQueryKey: useCallback(
      ({cursor, per_page}: {cursor: string; per_page: number}) => [
        `/organizations/${organization.slug}/autofix/automation-settings/`,
        {query: {cursor, per_page}},
      ],
      [organization.slug]
    ),
  });
}

type AutofixAutomationUpdate =
  | {
      autofixAutomationTuning: AutofixAutomationTuning;
      projectIds: string[];
      automatedRunStoppingPoint?:
        | never
        | ProjectSeerPreferences['automated_run_stopping_point'];
      projectRepoMappings?: never | Record<string, BackendRepository[]>;
    }
  | {
      automatedRunStoppingPoint: ProjectSeerPreferences['automated_run_stopping_point'];
      projectIds: string[];
      autofixAutomationTuning?: never | AutofixAutomationTuning;
      projectRepoMappings?: never | Record<string, BackendRepository[]>;
    }
  | {
      autofixAutomationTuning: AutofixAutomationTuning;
      automatedRunStoppingPoint: ProjectSeerPreferences['automated_run_stopping_point'];
      projectIds: string[];
      projectRepoMappings?: never | Record<string, BackendRepository[]>;
    }
  | {
      projectIds: string[];
      projectRepoMappings: Record<string, BackendRepository[]>;
      autofixAutomationTuning?: never | AutofixAutomationTuning;
      automatedRunStoppingPoint?:
        | never
        | ProjectSeerPreferences['automated_run_stopping_point'];
    };

export function useUpdateBulkAutofixAutomationSettings(
  options?: Omit<
    UseMutationOptions<unknown, Error, AutofixAutomationUpdate, unknown>,
    'mutationFn'
  >
) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {projects} = useProjects();
  const projectsById = useMemo(
    () => new Map(projects.map(project => [project.id, project])),
    [projects]
  );

  return useMutation<unknown, Error, AutofixAutomationUpdate, unknown>({
    mutationFn: (data: AutofixAutomationUpdate) => {
      return fetchMutation({
        method: 'POST',
        url: `/organizations/${organization.slug}/autofix/automation-settings/`,
        data,
      });
    },
    ...options,
    onSettled: (...args) => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${organization.slug}/autofix/automation-settings/`],
      });
      const [, , data] = args;
      data.projectIds.forEach(projectId => {
        const project = projectsById.get(projectId);
        if (!project) {
          return;
        }
        // Invalidate the query for ProjectOptions to Settings>Project>Seer details page
        queryClient.invalidateQueries({
          queryKey: [`/projects/${organization.slug}/${project.slug}/`],
        });
        // Invalidate the query for SeerPreferences to Settings>Project>Seer details page
        queryClient.invalidateQueries({
          queryKey: [`/projects/${organization.slug}/${project.slug}/seer/preferences/`],
        });
      });

      options?.onSettled?.(...args);
    },
  });
}
