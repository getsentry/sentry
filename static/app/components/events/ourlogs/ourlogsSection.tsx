import {useCallback, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {useDrawer} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';

import {ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS} from 'sentry/components/events/issueDetailsLazyRender';
import {OurlogsDrawer} from 'sentry/components/events/ourlogs/ourlogsDrawer';
import {LazyRender} from 'sentry/components/lazyRender';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueType} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import {replayRecordApiOptions} from 'sentry/utils/replays/hooks/useReplayData';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TableBody} from 'sentry/views/explore/components/table';
import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import {
  LogsPageDataProvider,
  useLogsPageDataQueryResult,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LOGS_DRAWER_QUERY_PARAM} from 'sentry/views/explore/logs/constants';
import type {LogsFrozenContextProviderProps} from 'sentry/views/explore/logs/logsFrozenContext';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogRowContent} from 'sentry/views/explore/logs/tables/logsTableRow';
import {getLogBodySearchTerms} from 'sentry/views/explore/logs/utils';
import {useQueryParamsSearch} from 'sentry/views/explore/queryParams/context';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

export function OurlogsSection({
  event,
  project,
  group,
}: {
  event: Event;
  group: Group;
  project: Project;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const traceId = event.contexts?.trace?.trace_id;

  // Replay-generated issues (eg. rage clicks) may not carry a usable trace context,
  // and even when they do it's only the first of the replay's traces. For these issue
  // types we correlate logs by the replay and its full set of trace ids. Other issue
  // types keep the trace-only behavior so we don't add a replay fetch to their path.
  const isReplayGeneratedIssue =
    group.issueType === IssueType.REPLAY_RAGE_CLICK ||
    group.issueType === IssueType.REPLAY_HYDRATION_ERROR;
  const replayId = isReplayGeneratedIssue ? getReplayIdFromEvent(event) : undefined;

  const {data: replayData, isLoading: isReplayLoading} = useQuery({
    ...replayRecordApiOptions({organizationIdOrSlug: organization.slug, replayId}),
    retry: false,
  });

  const freeze = useMemo<LogsFrozenContextProviderProps | undefined>(() => {
    const replayRecord = replayData?.data
      ? mapResponseToReplayRecord(replayData.data)
      : undefined;
    if (replayId && replayRecord?.started_at) {
      const traceIds = Array.from(
        new Set([...replayRecord.trace_ids, ...(traceId ? [traceId] : [])])
      );
      return {
        replayId,
        replayStartedAt: replayRecord.started_at,
        replayEndedAt: replayRecord.finished_at ?? undefined,
        ...(traceIds.length ? {traceIds} : {}),
      };
    }
    if (traceId) {
      return {traceId};
    }
    return;
  }, [replayId, replayData?.data, traceId]);

  if (replayId && isReplayLoading) {
    return null;
  }

  if (!freeze) {
    // No trace or replay to scope logs to (eg. profiling issues), so there's nothing
    // to show since logs are trace/replay specific.
    return null;
  }

  return (
    <LazyRender
      disabled={
        location.query[LOGS_DRAWER_QUERY_PARAM] === 'true' ||
        location.hash === `#${SectionKey.LOGS}`
      }
      observerOptions={ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS}
      withoutContainer
    >
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.ISSUE_DETAILS}
        source="state"
        freeze={freeze}
      >
        <LogsPageDataProvider disabled={false} staleTime={EXPLORE_FIVE_MIN_STALE_TIME}>
          <OurlogsSectionContent
            event={event}
            group={group}
            project={project}
            freeze={freeze}
          />
        </LogsPageDataProvider>
      </LogsQueryParamsProvider>
    </LazyRender>
  );
}

function OurlogsSectionContent({
  event,
  project,
  group,
  freeze,
}: {
  event: Event;
  freeze: LogsFrozenContextProviderProps;
  group: Group;
  project: Project;
}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const feature = organization.features.includes('ourlogs-enabled');
  const tableData = useLogsPageDataQueryResult();
  const logsSearch = useQueryParamsSearch();
  const highlightTerms = useMemo(() => getLogBodySearchTerms(logsSearch), [logsSearch]);
  const abbreviatedTableData = (tableData.data ?? []).slice(0, 5);
  const {openDrawer} = useDrawer();
  const viewAllButtonRef = useRef<HTMLButtonElement>(null);
  const sharedHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onOpenLogsDrawer = useCallback(
    (e: React.MouseEvent, expandedLogId?: string) => {
      e.stopPropagation();
      trackAnalytics('logs.issue_details.drawer_opened', {
        organization,
      });

      navigate(
        {
          ...location,
          query: {
            ...location.query,
            [LOGS_DRAWER_QUERY_PARAM]: 'true',
            ...(expandedLogId && {expandedLogId}),
          },
        },
        {replace: true}
      );
    },
    [navigate, location, organization]
  );

  const onEmbeddedRowClick = useCallback(
    (logItemId: string, clickEvent: React.MouseEvent) => {
      onOpenLogsDrawer(clickEvent, logItemId);
    },
    [onOpenLogsDrawer]
  );

  useEffect(() => {
    const shouldOpenDrawer = location.query[LOGS_DRAWER_QUERY_PARAM] === 'true';
    if (shouldOpenDrawer) {
      const expandedLogId = location.query.expandedLogId as string | undefined;

      openDrawer(
        () => (
          <LogsQueryParamsProvider
            analyticsPageSource={LogsAnalyticsPageSource.ISSUE_DETAILS}
            source="state"
            freeze={freeze}
          >
            <LogsPageDataProvider
              disabled={false}
              staleTime={EXPLORE_FIVE_MIN_STALE_TIME}
            >
              <OurlogsDrawer
                group={group}
                event={event}
                project={project}
                embeddedOptions={
                  expandedLogId ? {openWithExpandedIds: [expandedLogId]} : undefined
                }
                additionalData={{
                  event,
                  scrollToDisabled: !!expandedLogId,
                }}
              />
            </LogsPageDataProvider>
          </LogsQueryParamsProvider>
        ),
        {
          ariaLabel: 'logs drawer',
          drawerKey: 'logs-issue-drawer',
          shouldCloseOnInteractOutside: element => {
            const viewAllButton = viewAllButtonRef.current;
            return !viewAllButton?.contains(element);
          },
          onClose: () => {
            navigate(
              {
                ...location,
                query: {
                  ...location.query,
                  [LOGS_DRAWER_QUERY_PARAM]: undefined,
                  expandedLogId: undefined,
                },
              },
              {replace: true}
            );
          },
        }
      );
    }
  }, [location.query, freeze, group, event, project, openDrawer, navigate, location]);
  if (!feature) {
    return null;
  }
  if (!tableData?.data || (tableData.data.length === 0 && logsSearch.isEmpty())) {
    // Like breadcrumbs, we don't show the logs section if there are no logs.
    return null;
  }
  return (
    <FoldSection sectionKey={SectionKey.LOGS} title={t('Logs')}>
      <Stack>
        <SmallTable>
          <TableBody>
            {abbreviatedTableData?.map((row, index) => (
              <LogRowContent
                dataRow={row}
                meta={tableData.meta}
                highlightTerms={highlightTerms}
                embedded
                sharedHoverTimeoutRef={sharedHoverTimeoutRef}
                key={index}
                blockRowExpanding
                onEmbeddedRowClick={onEmbeddedRowClick}
              />
            ))}
          </TableBody>
        </SmallTable>
        {tableData.data && tableData.data.length > 5 ? (
          <div>
            <Button
              icon={<IconChevron direction="right" />}
              aria-label={t('View more')}
              size="sm"
              onClick={onOpenLogsDrawer}
              ref={viewAllButtonRef}
            >
              {t('View more')}
            </Button>
          </div>
        ) : null}
      </Stack>
    </FoldSection>
  );
}

const SmallTable = styled('table')`
  display: grid;
  grid-template-columns: 15px auto 1fr;
`;
