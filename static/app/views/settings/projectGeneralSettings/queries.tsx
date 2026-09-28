import {useMemo} from 'react';
import {useInfiniteQuery, useQueries, useQuery} from '@tanstack/react-query';

import type {SelectValue} from '@sentry/scraps/select';

import type {PathMappingValue} from 'sentry/components/connectRepository/type';
import type {
  Integration,
  IntegrationRepository,
  Repository,
} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {fetchMutation} from 'sentry/utils/queryClient';
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

function toPersistableOption(
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
      const option = toPersistableOption(
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

const DUPLICATE_CODE_MAPPING_MESSAGE = 'Code path config already exists';

function isDuplicateCodeMappingError(error: unknown): boolean {
  if (!(error instanceof RequestError) || error.responseJSON === undefined) {
    return false;
  }
  return JSON.stringify(error.responseJSON).includes(DUPLICATE_CODE_MAPPING_MESSAGE);
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
  return fetchMutation({
    url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/repo/', {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: project.slug},
    }),
    method: 'POST',
    data: {repositoryId},
  }).then(async () => {
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

    const failure = results.find(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected' && !isDuplicateCodeMappingError(result.reason)
    );
    if (failure) {
      throw failure.reason;
    }
  });
}
