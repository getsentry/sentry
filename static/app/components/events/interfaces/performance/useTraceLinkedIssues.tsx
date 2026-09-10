import {skipToken, useQuery} from '@tanstack/react-query';

import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

export const TRACE_ISSUES_STATS_PERIOD = '90d';
export const TRACE_ISSUES_STALE_TIME = 60_000;

export function useTraceLinkedIssues({event}: {event: Event}) {
  const organization = useOrganization();
  const traceId = event.contexts.trace?.trace_id;
  const currentIssueId = event.groupID;
  const query =
    traceId && currentIssueId
      ? `trace:${traceId} !issue.id:${currentIssueId}`
      : undefined;
  const queryParams = {
    collapse: 'filtered',
    limit: '20',
    project: '-1',
    query,
    statsPeriod: TRACE_ISSUES_STATS_PERIOD,
  };
  const {data, isError, isPending} = useQuery({
    ...apiOptions.as<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: query ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: queryParams,
      staleTime: TRACE_ISSUES_STALE_TIME,
    }),
    select: selectJsonWithHeaders,
  });
  const groups = data?.json ?? [];

  return {
    groups,
    isError,
    isPending,
    query,
    queryParams,
    totalHits: data?.headers['X-Hits'] ?? groups.length,
  };
}
