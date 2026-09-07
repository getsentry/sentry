import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {ClippedBox} from 'sentry/components/clippedBox';
import {GroupList} from 'sentry/components/issues/groupList';
import {t, tn} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  TRACE_ISSUES_STALE_TIME,
  TRACE_ISSUES_STATS_PERIOD,
  useTraceLinkedIssues,
} from './useTraceLinkedIssues';

export function TraceLinkedIssues({
  event,
  source = 'issue-details-trace-preview',
}: {
  event: Event;
  source?: string;
}) {
  const organization = useOrganization();
  const {groups, isError, isPending, query, queryParams, totalHits} =
    useTraceLinkedIssues({event});

  useRouteAnalyticsParams(groups.length > 0 ? {has_related_trace_issue: true} : {});

  if (isPending || isError || groups.length === 0 || !query) {
    return null;
  }

  const traceId = event.contexts.trace?.trace_id;
  const issueTable = (
    <GroupList
      query={query}
      queryParams={queryParams}
      source={source}
      canSelectGroups={false}
      withColumns={['event', 'firstSeen', 'lastSeen']}
      withPagination={false}
      numPlaceholderRows={3}
      staleTime={TRACE_ISSUES_STALE_TIME}
    />
  );

  return (
    <Stack gap="md">
      <Flex align="center" gap="xs" wrap="wrap">
        <Text>
          {tn(
            '%s other issue appears in this trace.',
            '%s other issues appear in this trace.',
            totalHits
          )}
        </Text>
        <Link
          to={{
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {
              project: '-1',
              query: `trace:${traceId}`,
              statsPeriod: TRACE_ISSUES_STATS_PERIOD,
            },
          }}
        >
          {t('Open in Issues')}
        </Link>
      </Flex>
      {groups.length > 3 ? (
        <ClippedIssueTable
          defaultClipped
          collapsible
          clipHeight={300}
          btnText={t('View more')}
          collapseBtnText={t('View fewer')}
        >
          {issueTable}
        </ClippedIssueTable>
      ) : (
        issueTable
      )}
    </Stack>
  );
}

const ClippedIssueTable = styled(ClippedBox)`
  padding: 0;
`;
