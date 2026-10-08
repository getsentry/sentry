import {useMemo} from 'react';
import {useInfiniteQuery, useQuery, useQueryClient} from '@tanstack/react-query';

import type {SelectValue} from '@sentry/scraps/select';

import {
  normalizeRoot,
  resolveBranch,
} from 'sentry/components/connectRepository/normalization';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import type {
  Integration,
  IntegrationRepository,
  RepositoryProjectPathConfig,
} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {fetchMutation, QUERY_API_CLIENT} from 'sentry/utils/queryClient';
import {organizationRepositoriesInfiniteOptions} from 'sentry/utils/repositories/repoQueryOptions';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

export type ProjectRepoListItem = {
  externalId: string | null;
  id: string;
  integrationId: string | null;
  mappingCount: number;
  projectId: string;
  providerKey: string | null;
  repoName: string;
  repositoryId: string;
  source: string;
};

const PROJECT_REPO_STALE_TIME_MS = 10_000;

export function projectRepoInfiniteOptions({
  orgSlug,
  projectSlug,
}: {
  orgSlug: string;
  projectSlug: string;
}) {
  return apiOptions.asInfinite<ProjectRepoListItem[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/repo/',
    {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
      query: {includeMappingCount: '1', per_page: 100},
      staleTime: PROJECT_REPO_STALE_TIME_MS,
    }
  );
}

export type RepoSelectOption = SelectValue<string> & {
  integrationId: string;
  repositoryId: string;
  defaultBranch?: string | null;
  externalId?: string;
  providerKey?: string;
};

type RepoGroup = {
  label: string;
  options: RepoSelectOption[];
};

const REPOS_STALE_TIME_MS = 60_000;

function scmIntegrationsOptions(orgSlug: string) {
  return apiOptions.as<Integration[]>()(
    '/organizations/$organizationIdOrSlug/integrations/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: {integrationType: 'source_code_management'},
      staleTime: REPOS_STALE_TIME_MS,
    }
  );
}

function integrationReposOptions(
  orgSlug: string,
  integrationId: string,
  search?: string
) {
  return apiOptions.as<{repos: IntegrationRepository[]}>()(
    '/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/',
    {
      path: {organizationIdOrSlug: orgSlug, integrationId},
      query: search ? {search} : undefined,
      staleTime: REPOS_STALE_TIME_MS,
    }
  );
}

/**
 * Resolves the default branch for a repository being edited.
 *
 * Fast path: when seeded mappings already carry a defaultBranch, return it
 * immediately with no network calls.
 *
 * Slow path: when the repo has no mappings yet (or all have null branches),
 * fetch the integration's repos filtered by repoName (a single Search API
 * request on GitHub instead of paginating through the full installation list),
 * then match by externalId to be collision-safe. retry: false so a 500 fails
 * fast and the form still renders (falls back to "main").
 */
export function useEditRepoInfo({
  orgSlug,
  integrationId,
  externalId,
  repoName,
  defaultBranchFromMappings,
}: {
  integrationId: string | null;
  orgSlug: string;
  // undefined = mappings not yet loaded; null = loaded but no branch found.
  defaultBranchFromMappings?: string | null;
  externalId?: string | null;
  repoName?: string;
}): {
  defaultBranch: string | null;
  isPending: boolean;
} {
  const mappingsLoaded = defaultBranchFromMappings !== undefined;
  const needsBranchLookup =
    mappingsLoaded &&
    !defaultBranchFromMappings &&
    Boolean(integrationId) &&
    Boolean(externalId);

  const integrationReposQuery = useQuery({
    ...integrationReposOptions(orgSlug, integrationId ?? '', repoName),
    enabled: needsBranchLookup,
    retry: false,
  });

  const defaultBranch = useMemo(() => {
    if (defaultBranchFromMappings) {
      return defaultBranchFromMappings;
    }
    if (!externalId || !integrationReposQuery.data) {
      return null;
    }
    return (
      integrationReposQuery.data.repos.find(r => r.externalId === externalId)
        ?.defaultBranch ?? null
    );
  }, [defaultBranchFromMappings, externalId, integrationReposQuery.data]);

  const isPending =
    needsBranchLookup &&
    !integrationReposQuery.isError &&
    integrationReposQuery.isPending;

  return {defaultBranch, isPending};
}

export function useGroupedRepoOptions(orgSlug: string): {
  groupedOptions: RepoGroup[];
  isPending: boolean;
} {
  const organization = useOrganization();
  const {data: integrations = [], isPending: isIntegrationsPending} = useQuery(
    scmIntegrationsOptions(orgSlug)
  );

  const orgReposQuery = useInfiniteQuery(
    organizationRepositoriesInfiniteOptions({
      organization,
      query: {status: 'active', per_page: 100},
      staleTime: REPOS_STALE_TIME_MS,
    })
  );
  useFetchAllPages({result: orgReposQuery});

  const activeIntegrations = useMemo(
    () =>
      integrations.filter(
        i => i.organizationIntegrationStatus === 'active' && i.status === 'active'
      ),
    [integrations]
  );

  const integrationById = useMemo(
    () => new Map(activeIntegrations.map(i => [i.id, i])),
    [activeIntegrations]
  );

  const groupedOptions = useMemo(() => {
    const groupMap = new Map<string, RepoGroup>();
    for (const page of orgReposQuery.data?.pages ?? []) {
      for (const repo of page.json) {
        const integration = integrationById.get(repo.integrationId);
        if (!integration) {
          continue;
        }
        const option: RepoSelectOption = {
          value: repo.id,
          label: repo.name,
          leadingItems: getIntegrationIcon(integration.provider.key, 'sm'),
          providerKey: integration.provider.key,
          integrationId: repo.integrationId,
          repositoryId: repo.id,
          externalId: repo.externalId,
        };
        let group = groupMap.get(repo.integrationId);
        if (!group) {
          group = {label: integration.name, options: []};
          groupMap.set(repo.integrationId, group);
        }
        group.options.push(option);
      }
    }
    return Array.from(groupMap.values());
  }, [orgReposQuery.data, integrationById]);

  const isOrgReposPending = !orgReposQuery.isError && orgReposQuery.isPending;

  return {
    groupedOptions,
    isPending: isIntegrationsPending || isOrgReposPending,
  };
}

export function projectCodeMappingsOptions({
  orgSlug,
  projectId,
}: {
  orgSlug: string;
  projectId: string;
}) {
  return apiOptions.as<RepositoryProjectPathConfig[]>()(
    '/organizations/$organizationIdOrSlug/code-mappings/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: {project: projectId},
      staleTime: 30_000,
    }
  );
}

// All code mappings for an org — the paginated query used by the Repositories
// page to build project chips. Extracted here so save/edit can invalidate the
// same key and keep chips up to date without a full page reload.
export function orgCodeMappingsInfiniteOptions(orgSlug: string) {
  return apiOptions.asInfinite<RepositoryProjectPathConfig[]>()(
    '/organizations/$organizationIdOrSlug/code-mappings/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: {per_page: 100},
      staleTime: 10_000,
    }
  );
}

export function orgProjectsOptions(orgSlug: string) {
  return apiOptions.as<Project[]>()('/organizations/$organizationIdOrSlug/projects/', {
    path: {organizationIdOrSlug: orgSlug},
    query: {all_projects: '1', collapse: ['latestDeploys', 'unusedFeatures']},
    staleTime: 60_000,
  });
}

/**
 * Returns a function that invalidates all repo-related query caches.
 * Pass `project` when the project is known (project-locked flows and after
 * the user picks a project in repo-locked flows) to also refresh the
 * per-project repo list and code-mappings caches. Always invalidates the
 * org-level code-mappings cache so project chips on the Repositories page
 * refresh after a save.
 */
export function useInvalidateRepoQueries(orgSlug: string) {
  const queryClient = useQueryClient();
  return (project?: {id: string; slug: string}) =>
    Promise.all([
      ...(project
        ? [
            queryClient.invalidateQueries(
              projectRepoInfiniteOptions({orgSlug, projectSlug: project.slug})
            ),
            queryClient.invalidateQueries(
              projectCodeMappingsOptions({orgSlug, projectId: project.id})
            ),
          ]
        : []),
      queryClient.invalidateQueries(orgCodeMappingsInfiniteOptions(orgSlug)),
    ]);
}

const DUPLICATE_CODE_MAPPING_MESSAGE = 'Code path config already exists';

function isDuplicateCodeMappingError(error: unknown): boolean {
  if (!(error instanceof RequestError) || error.responseJSON === undefined) {
    return false;
  }
  return JSON.stringify(error.responseJSON).includes(DUPLICATE_CODE_MAPPING_MESSAGE);
}

type CodeMappingRow = {repoId: string; sourceRoot: string; stackRoot: string};

async function repoOwnsCodeMapping(
  orgSlug: string,
  projectId: string,
  repositoryId: string,
  stackRoot: string,
  sourceRoot: string
): Promise<boolean> {
  const rows: CodeMappingRow[] = await QUERY_API_CLIENT.requestPromise(
    getApiUrl('/organizations/$organizationIdOrSlug/code-mappings/', {
      path: {organizationIdOrSlug: orgSlug},
    }),
    {method: 'GET', query: {project: projectId}}
  );
  return rows.some(
    row =>
      row.repoId === repositoryId &&
      row.stackRoot === stackRoot &&
      row.sourceRoot === sourceRoot
  );
}

export async function saveProjectRepoConnection({
  orgSlug,
  project,
  repositoryId,
  integrationId,
  pathMappings,
}: {
  integrationId: string;
  orgSlug: string;
  pathMappings: PathMappingValue[];
  project: Pick<Project, 'id' | 'slug'>;
  repositoryId: string;
}) {
  await fetchMutation({
    url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/repo/', {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: project.slug},
    }),
    method: 'POST',
    data: {repositoryId},
  });

  const results = await Promise.allSettled(
    pathMappings.map(mapping =>
      fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/code-mappings/', {
          path: {organizationIdOrSlug: orgSlug},
        }),
        method: 'POST',
        data: {
          integrationId,
          repositoryId,
          projectId: project.id,
          stackRoot: mapping.stackRoot,
          sourceRoot: mapping.sourceRoot,
          defaultBranch: mapping.branch,
        },
      })
    )
  );

  for (const [result, mapping] of results.map((r, i) => [r, pathMappings[i]!] as const)) {
    if (result.status === 'fulfilled') {
      continue;
    }
    if (!isDuplicateCodeMappingError(result.reason)) {
      throw result.reason;
    }
    // Duplicate error: only safe to ignore when this repo already owns that
    // exact stack/source pair (idempotent retry). Any other owner is a real
    // conflict that the user must resolve.
    const isIdempotentRetry = await repoOwnsCodeMapping(
      orgSlug,
      project.id,
      repositoryId,
      mapping.stackRoot,
      mapping.sourceRoot
    );
    if (!isIdempotentRetry) {
      throw result.reason;
    }
  }
}

// Form fields coerce a null server branch to "main"; compare normalized values
// so displaying the default is not treated as an edit.
function mappingHasChanged(
  submitted: PathMappingValue,
  original: RepositoryProjectPathConfig
): boolean {
  return (
    normalizeRoot(submitted.stackRoot) !== normalizeRoot(original.stackRoot) ||
    normalizeRoot(submitted.sourceRoot) !== normalizeRoot(original.sourceRoot) ||
    resolveBranch(submitted.branch) !== resolveBranch(original.defaultBranch ?? '')
  );
}

// True for rows sent on save: new rows and seeded rows that changed.
export function isPendingWrite(
  mapping: PathMappingValue,
  seededById: Map<string, RepositoryProjectPathConfig>
): boolean {
  const original = mapping.id ? seededById.get(mapping.id) : undefined;
  return !original || mappingHasChanged(mapping, original);
}

export async function editProjectRepoMappings({
  orgSlug,
  project,
  repositoryId,
  integrationId,
  seededMappings,
  submittedMappings,
}: {
  integrationId: string;
  orgSlug: string;
  project: Pick<Project, 'id' | 'slug'>;
  repositoryId: string;
  seededMappings: RepositoryProjectPathConfig[];
  submittedMappings: PathMappingValue[];
}): Promise<void> {
  const seededById = new Map(seededMappings.map(m => [m.id, m]));
  const submittedIds = new Set(submittedMappings.flatMap(m => (m.id ? [m.id] : [])));

  // Exclude Code Owner–protected mappings: the DB rejects their deletion anyway,
  // and the UI prevents users from removing them in the first place.
  const toDelete = seededMappings.filter(m => !submittedIds.has(m.id) && !m.hasCodeOwner);
  const toUpdate = submittedMappings.filter(
    m => m.id && isPendingWrite(m, seededById) && seededById.has(m.id)
  );
  const toCreate = submittedMappings.filter(m => isPendingWrite(m, seededById) && !m.id);

  // 1. Deletes first. 404: already deleted on a prior partial save — treat as success.
  await Promise.all(
    toDelete.map(async m => {
      try {
        await fetchMutation({
          url: getApiUrl(
            '/organizations/$organizationIdOrSlug/code-mappings/$configId/',
            {path: {organizationIdOrSlug: orgSlug, configId: m.id}}
          ),
          method: 'DELETE',
        });
      } catch (error) {
        if (error instanceof RequestError && error.status === 404) {
          return;
        }
        throw error;
      }
    })
  );

  // 2. Updates
  await Promise.all(
    toUpdate.map(m =>
      fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/code-mappings/$configId/', {
          path: {organizationIdOrSlug: orgSlug, configId: m.id!},
        }),
        method: 'PUT',
        data: {
          integrationId,
          repositoryId,
          projectId: project.id,
          stackRoot: m.stackRoot,
          sourceRoot: m.sourceRoot,
          defaultBranch: m.branch,
        },
      })
    )
  );

  // 3. Creates — same duplicate-ignore logic as saveProjectRepoConnection
  const createResults = await Promise.allSettled(
    toCreate.map(m =>
      fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/code-mappings/', {
          path: {organizationIdOrSlug: orgSlug},
        }),
        method: 'POST',
        data: {
          integrationId,
          repositoryId,
          projectId: project.id,
          stackRoot: m.stackRoot,
          sourceRoot: m.sourceRoot,
          defaultBranch: m.branch,
        },
      })
    )
  );

  for (const [result, mapping] of createResults.map(
    (r, i) => [r, toCreate[i]!] as const
  )) {
    if (result.status === 'fulfilled') {
      continue;
    }
    if (!isDuplicateCodeMappingError(result.reason)) {
      throw result.reason;
    }
    const isIdempotent = await repoOwnsCodeMapping(
      orgSlug,
      project.id,
      repositoryId,
      mapping.stackRoot,
      mapping.sourceRoot
    );
    if (!isIdempotent) {
      throw result.reason;
    }
  }
}
