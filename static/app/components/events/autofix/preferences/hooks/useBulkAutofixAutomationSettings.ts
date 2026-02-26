import {useMemo} from 'react';

import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import getApiUrl from 'sentry/utils/api/getApiUrl';
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

export function bulkAutofixAutomationSettingsInfiniteOptions({
  organization,
}: {
  organization: Organization;
}) {
  return apiOptions.asInfinite<AutofixAutomationSettings[]>()(
    '/organizations/$organizationIdOrSlug/autofix/automation-settings/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {per_page: 100},
      staleTime: 0,
    }
  );
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
        url: getApiUrl(
          `/organizations/$organizationIdOrSlug/autofix/automation-settings/`,
          {
            path: {organizationIdOrSlug: organization.slug},
          }
        ),
        data,
      });
    },
    ...options,
    onSettled: (...args) => {
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl(`/organizations/$organizationIdOrSlug/autofix/automation-settings/`, {
            path: {organizationIdOrSlug: organization.slug},
          }),
        ],
      });
      const [, , data] = args;
      data.projectIds.forEach(projectId => {
        const project = projectsById.get(projectId);
        if (!project) {
          return;
        }
        // Invalidate the query for ProjectOptions to Settings>Project>Seer details page
        queryClient.invalidateQueries({
          queryKey: [
            getApiUrl(`/projects/$organizationIdOrSlug/$projectIdOrSlug/`, {
              path: {
                organizationIdOrSlug: organization.slug,
                projectIdOrSlug: project.slug,
              },
            }),
          ],
        });
        // Invalidate the query for SeerPreferences to Settings>Project>Seer details page
        queryClient.invalidateQueries({
          queryKey: [
            getApiUrl(
              `/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/preferences/`,
              {
                path: {
                  organizationIdOrSlug: organization.slug,
                  projectIdOrSlug: project.slug,
                },
              }
            ),
          ],
        });
      });

      options?.onSettled?.(...args);
    },
  });
}
