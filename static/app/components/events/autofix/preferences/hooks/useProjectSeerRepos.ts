import {useCallback} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {projectSeerPreferencesApiOptions} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export interface SeerProjectRepoBranchOverride {
  branchName: string;
  id: string;
  tagName: string;
  tagValue: string;
}

/**
 * A project's connected repo as returned by the `seer/repos/` endpoints.
 *
 * Unlike the legacy `SeerRepoDefinition` (snake_case, keyed by `external_id`),
 * this is camelCase and addressed by `repositoryId` (the Sentry Repository PK),
 * which is what the add/update/delete endpoints expect.
 */
export interface SeerProjectRepo {
  branchName: string | null;
  branchOverrides: SeerProjectRepoBranchOverride[];
  externalId: string;
  id: string;
  instructions: string | null;
  integrationId: string | null;
  name: string;
  organizationId: string;
  owner: string;
  provider: string;
  repositoryId: string;
}

export interface SeerProjectRepoBranchOverrideInput {
  branchName: string;
  tagName: string;
  tagValue: string;
}

/** Payload for adding/replacing repos via the collection endpoints. */
export interface SeerProjectRepoInput {
  repositoryId: number;
  branchName?: string | null;
  branchOverrides?: SeerProjectRepoBranchOverrideInput[];
  instructions?: string | null;
}

/**
 * Partial payload for updating a single connected repo.
 *
 * Defined as a type alias (not an interface) so it satisfies the
 * `Record<string, unknown>` shape `fetchMutation` expects for its `data`.
 */
export type UpdateSeerProjectRepoInput = {
  branchName?: string | null;
  branchOverrides?: SeerProjectRepoBranchOverrideInput[];
  instructions?: string | null;
};

export function projectSeerReposApiOptions(orgSlug: string, projectSlug: string) {
  return apiOptions.as<SeerProjectRepo[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/repos/',
    {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
      // Connected repos are capped per project (MAX_REPOS_LIMIT), so a single
      // large page always covers the full set.
      query: {per_page: 100},
      staleTime: 0,
    }
  );
}

export function useProjectSeerRepos(project: Project) {
  const organization = useOrganization();

  return useQuery(projectSeerReposApiOptions(organization.slug, project.slug));
}

/**
 * Invalidate every query that reflects a project's connected repos.
 *
 * The new `seer/repos/` endpoints and the legacy `seer/preferences/` endpoint
 * read the same `SeerProjectRepository` rows, and other writers (stopping
 * point, agent handoff) still round-trip `preference.repositories`. So a repo
 * write has to refresh the preferences cache and the org-level bulk settings
 * (which surface `reposCount`) in addition to the repos list itself.
 */
function useInvalidateSeerRepoQueries(project: Project) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: projectSeerReposApiOptions(organization.slug, project.slug).queryKey,
    });
    queryClient.invalidateQueries({
      queryKey: projectSeerPreferencesApiOptions(organization.slug, project.slug)
        .queryKey,
    });
    queryClient.invalidateQueries({
      queryKey: bulkAutofixAutomationSettingsInfiniteOptions({organization}).queryKey,
    });
  }, [organization, project.slug, queryClient]);
}

export function useAddProjectSeerRepos(project: Project) {
  const organization = useOrganization();
  const invalidate = useInvalidateSeerRepoQueries(project);

  return useMutation({
    mutationFn: (repos: SeerProjectRepoInput[]) =>
      fetchMutation({
        method: 'POST',
        url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/repos/', {
          path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        }),
        data: {repos},
      }),
    onSettled: invalidate,
  });
}

export function useReplaceProjectSeerRepos(project: Project) {
  const organization = useOrganization();
  const invalidate = useInvalidateSeerRepoQueries(project);

  return useMutation({
    mutationFn: (repos: SeerProjectRepoInput[]) =>
      fetchMutation({
        method: 'PUT',
        url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/repos/', {
          path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        }),
        data: {repos},
      }),
    onSettled: invalidate,
  });
}

export function useUpdateProjectSeerRepo(project: Project) {
  const organization = useOrganization();
  const invalidate = useInvalidateSeerRepoQueries(project);

  return useMutation({
    mutationFn: ({
      repositoryId,
      data,
    }: {
      data: UpdateSeerProjectRepoInput;
      repositoryId: string | number;
    }) =>
      fetchMutation<SeerProjectRepo>({
        method: 'PUT',
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/repos/$repoId/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.slug,
              repoId: repositoryId,
            },
          }
        ),
        data,
      }),
    onSettled: invalidate,
  });
}

export function useDeleteProjectSeerRepo(project: Project) {
  const organization = useOrganization();
  const invalidate = useInvalidateSeerRepoQueries(project);

  return useMutation({
    mutationFn: (repositoryId: string | number) =>
      fetchMutation({
        method: 'DELETE',
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/repos/$repoId/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.slug,
              repoId: repositoryId,
            },
          }
        ),
      }),
    onSettled: invalidate,
  });
}
