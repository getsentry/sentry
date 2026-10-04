import {useQuery} from '@tanstack/react-query';

import {Link} from '@sentry/scraps/link';

import {Count} from 'sentry/components/count';
import {Placeholder} from 'sentry/components/placeholder';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getConventionIssuesPath,
  getConventionIssuesQuery,
} from 'sentry/views/codeConventions/utils';

interface Props {
  conventionName: string;
  repoName: string;
}

export function ConventionIssueCount({conventionName, repoName}: Props) {
  const organization = useOrganization();
  const query = getConventionIssuesQuery(conventionName);

  // Only the X-Hits total is needed, so fetch a single issue.
  const {data: hits, isPending} = useQuery({
    ...apiOptions.as<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {...query, limit: 1},
      staleTime: 60 * 1000,
    }),
    select: data => data.headers['X-Hits'],
  });

  if (isPending) {
    return <Placeholder width="32px" height="16px" />;
  }

  return (
    <Link
      to={normalizeUrl(
        getConventionIssuesPath(organization.slug, repoName, conventionName)
      )}
    >
      <Count value={hits ?? 0} />
    </Link>
  );
}
