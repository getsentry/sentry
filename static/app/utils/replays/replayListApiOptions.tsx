import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {uniq} from 'sentry/utils/array/uniq';
import {
  REPLAY_LIST_FIELDS,
  type ReplayListQueryReferrer,
  type ReplayListRecord,
} from 'sentry/views/replays/types';

interface QueryOptions {
  cursor?: string;
  end?: string;
  environment?: string[];
  project?: string[];
  query?: string;
  sort?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
}

interface Props {
  options: {query?: QueryOptions};
  organization: Organization;
  queryReferrer: ReplayListQueryReferrer;
}

type ReplaysListResponse = {
  data: ReplayListRecord[];
  enabled: boolean;
};

function getQueryForReplaysList({
  options,
  queryReferrer,
}: Pick<Props, 'options' | 'queryReferrer'>) {
  if (!options.query) {
    return {};
  }

  // HACK!!! Because the sort field needs to be in the eventView, but I cannot
  // ask the server for compound fields like `os.name`.
  const splitFields = REPLAY_LIST_FIELDS.map(field => field.split('.')[0]);
  const fields = uniq(splitFields);

  // when queryReferrer === 'issueReplays' we override the global view check on the backend
  // we also require a project param otherwise we won't yield results
  const {project: originalProject} = options.query;
  const project =
    queryReferrer === 'issueReplays' || queryReferrer === 'transactionReplays'
      ? ALL_ACCESS_PROJECTS
      : originalProject;

  const query = Object.fromEntries(
    Object.entries(options.query).filter(([_key, val]) => val !== '')
  );

  return {
    per_page: 50,
    ...query,
    field: fields,
    project,
    queryReferrer,
  };
}

export function replayListApiOptions(props: Props) {
  const query = getQueryForReplaysList(props);

  return apiOptions.as<ReplaysListResponse>()(
    '/organizations/$organizationIdOrSlug/replays/',
    {
      path: {organizationIdOrSlug: props.organization.slug},
      query,
      staleTime: 0,
    }
  );
}

/** @internal exported for stories */
export function replayListInfiniteApiOptions(props: Props) {
  const query = getQueryForReplaysList(props);

  return apiOptions.asInfinite<{data: ReplayListRecord[]}>()(
    '/organizations/$organizationIdOrSlug/replays/',
    {
      path: {organizationIdOrSlug: props.organization.slug},
      query,
      staleTime: 0,
    }
  );
}
