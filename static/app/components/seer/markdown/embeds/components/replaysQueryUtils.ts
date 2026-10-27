import queryString from 'query-string';

import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import type {Organization} from 'sentry/types/organization';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';

export type ReplaysQueryData = EmbedOutput<'replaysQuery'>;

/**
 * The replays list takes its page filters as plain query params rather than
 * through the Explore URL builders, so this doesn't go via `toPageFilters`.
 */
export function getReplaysQueryHref(
  data: ReplaysQueryData,
  organization: Organization
): string {
  const {query, sort, projects, environments, statsPeriod, start, end} = data;

  return queryString.stringifyUrl({
    url: makeReplaysPathname({organization, path: '/'}),
    query: {
      query,
      sort,
      project: projects,
      environment: environments,
      statsPeriod,
      start,
      end,
    },
  });
}
