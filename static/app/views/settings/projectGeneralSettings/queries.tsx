import {useMemo} from 'react';
import {
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type {SelectValue} from '@sentry/scraps/select';

import {
  normalizeRoot,
  resolveBranch,
} from 'sentry/components/connectRepository/normalization';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import type {
  Integration,
  IntegrationRepository,
  Repository,
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
  id: string;
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

function integrationReposOptions(orgSlug: string, integrationId: string) {
  return apiOptions.as<{repos: IntegrationRepository[]}>()(
    '/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/',
    {
      path: {organizationIdOrSlug: orgSlug, integrationId},
      staleTime: REPOS_STALE_TIME_MS,
    }
  );
}

// Builds a RepoSelectOption from an integration repo and its matching Sentry
// repository record. Returns null when the Sentry repo hasn't been imported yet.
function buildRepoSelectOption(
  integration: Integration,
  repo: IntegrationRepository,
  sentryRepo: Repository | undefined
): RepoSelectOption | null {
  if (!sentryRepo) {
    return null;
  }
  return {
    value: `${integration.id}:${repo.identifier}`,
    label: repo.name,
    leadingItems: getIntegrationIcon(integration.provider.key, 'sm'),
    defaultBranch: repo.defaultBranch,
    providerKey: integration.provider.key,
    integrationId: integration.id,
    repositoryId: sentryRepo.id,
  };
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

  const sentryRepoByIntegrationAndExternalId = useMemo(() => {
    const map = new Map<string, Repository>();
    for (const page of orgReposQuery.data?.pages ?? []) {
      for (const repo of page.json) {
        map.set(`${repo.integrationId}:${repo.externalId}`, repo);
      }
    }
    return map;
  }, [orgReposQuery.data]);

  const activeIntegrations = useMemo(
    () =>
      integrations.filter(
        i => i.organizationIntegrationStatus === 'active' && i.status === 'active'
      ),
    [integrations]
  );

  const integrationRepoResults = useQueries({
    queries: activeIntegrations.map(i => integrationReposOptions(orgSlug, i.id)),
  });

  const groupedOptions = activeIntegrations.flatMap((integration, idx) => {
    const options = (integrationRepoResults[idx]?.data?.repos ?? []).flatMap(repo => {
      const option = buildRepoSelectOption(
        integration,
        repo,
        sentryRepoByIntegrationAndExternalId.get(`${integration.id}:${repo.externalId}`)
      );
      return option ? [option] : [];
    });
    return options.length > 0 ? [{label: integration.name, options}] : [];
  });

  const isOrgReposPending =
    !orgReposQuery.isError &&
    (orgReposQuery.isPending ||
      orgReposQuery.isFetchingNextPage ||
      orgReposQuery.hasNextPage);

  return {
    groupedOptions,
    isPending:
      isIntegrationsPending ||
      integrationRepoResults.some(r => r.isPending) ||
      isOrgReposPending,
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

export function useInvalidateRepoQueries(
  orgSlug: string,
  projectSlug: string,
  projectId: string
) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries(projectRepoInfiniteOptions({orgSlug, projectSlug})),
      queryClient.invalidateQueries(projectCodeMappingsOptions({orgSlug, projectId})),
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
  project: Project;
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

const CODE_OWNER_PROTECTED_MESSAGE =
  'This path mapping is used by a Code Owner rule and cannot be removed. Delete the Code Owner rule first.';

export type EditSaveResult = {
  codeOwnerMessages: string[];
};

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
  project: Project;
  repositoryId: string;
  seededMappings: RepositoryProjectPathConfig[];
  submittedMappings: PathMappingValue[];
}): Promise<EditSaveResult> {
  const submittedIds = new Set(submittedMappings.flatMap(m => (m.id ? [m.id] : [])));

  const toDelete = seededMappings.filter(m => !submittedIds.has(m.id));
  const toUpdate = submittedMappings.filter(m => {
    if (!m.id) {
      return false;
    }
    const original = seededMappings.find(s => s.id === m.id);
    return original ? mappingHasChanged(m, original) : false;
  });
  const toCreate = submittedMappings.filter(m => !m.id);

  const codeOwnerMessages: string[] = [];

  // 1. Deletes first. 409: Code Owner rule still uses this mapping — warn and
  //    continue. 404: already deleted on a prior partial save — treat as success.
  await Promise.all(
    toDelete.map(async m => {
      try {
        await fetchMutation({
          url: getApiUrl(
            '/organizations/$organizationIdOrSlug/code-mappings/$configId/',
            {
              path: {organizationIdOrSlug: orgSlug, configId: m.id},
            }
          ),
          method: 'DELETE',
        });
      } catch (error) {
        if (!(error instanceof RequestError)) {
          throw error;
        }
        if (error.status === 409) {
          codeOwnerMessages.push(CODE_OWNER_PROTECTED_MESSAGE);
          return;
        }
        if (error.status === 404) {
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

  return {codeOwnerMessages};
}
