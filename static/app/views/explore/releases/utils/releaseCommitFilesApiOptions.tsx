import type {CommitFile, Repository} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

// These are the URL params that our project/date/env picker generates (+ cursor for pagination)
type PageFilterUrlParams =
  | 'start'
  | 'end'
  | 'utc'
  | 'statsPeriod'
  | 'project'
  | 'environment';
type OtherUrlParams = 'cursor' | 'perPage';

interface Params extends Partial<
  Record<
    PageFilterUrlParams | OtherUrlParams,
    string | string[] | number | null | undefined
  >
> {
  organization: Organization;
  release: string;
  activeRepository?: Repository;
}
export function releaseCommitFilesApiOptions({
  release,
  organization,
  activeRepository,
  perPage = 40,
  ...query
}: Params) {
  return apiOptions.as<CommitFile[]>()(
    '/organizations/$organizationIdOrSlug/releases/$version/commitfiles/',
    {
      path: {organizationIdOrSlug: organization.slug, version: release},
      query: {
        ...query,
        per_page: perPage,
        ...(activeRepository
          ? {
              repo_id: activeRepository.externalId,
              repo_name: activeRepository.name,
            }
          : {}),
      },
      staleTime: Infinity,
    }
  );
}
