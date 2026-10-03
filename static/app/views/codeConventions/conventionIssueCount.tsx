import {useQuery} from '@tanstack/react-query';

import {Link} from '@sentry/scraps/link';

import {Count} from 'sentry/components/count';
import {Placeholder} from 'sentry/components/placeholder';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

// The `coding-conventions` project that @sentry/refactor-tasks reports into.
const CONVENTIONS_PROJECT_ID = '4511567035432960';
const STATS_PERIOD = '90d';

interface Props {
  title: string;
}

export function ConventionIssueCount({title}: Props) {
  const organization = useOrganization();
  const query = {
    project: CONVENTIONS_PROJECT_ID,
    query: `is:unresolved title:"*${title}*"`,
    statsPeriod: STATS_PERIOD,
  };

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
      to={{
        pathname: normalizeUrl(`/organizations/${organization.slug}/issues/`),
        query,
      }}
    >
      <Count value={hits ?? 0} />
    </Link>
  );
}
