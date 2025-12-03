import {useCallback, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {OurlogsDrawer} from 'sentry/components/events/ourlogs/ourlogsDrawer';
import useDrawer from 'sentry/components/globalDrawer';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {TableBody} from 'sentry/views/explore/components/table';
import {
  LogsPageDataProvider,
  useLogsPageDataQueryResult,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LOGS_DRAWER_QUERY_PARAM} from 'sentry/views/explore/logs/constants';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogRowContent} from 'sentry/views/explore/logs/tables/logsTableRow';
import {useQueryParamsSearch} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export function OurlogsSection({
  event,
  project,
  group,
}: {
  event: Event;
  group: Group;
  project: Project;
}) {
  const traceId = event.contexts?.trace?.trace_id;
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.ISSUE_DETAILS}
      source="state"
      freeze={traceId ? {traceId} : undefined}
    >
      <LogsPageDataProvider disabled={!traceId}>
        <OurlogsSectionContent event={event} group={group} project={project} />
      </LogsPageDataProvider>
    </LogsQueryParamsProvider>
  );
}

function OurlogsSectionContent({
  event,
  project,
  group,
}: {
  event: Event;
  group: Group;
  project: Project;
}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const feature = organization.features.includes('ourlogs-enabled');
  const tableData = useLogsPageDataQueryResult();
  const logsSearch = useQueryParamsSearch();
  const abbreviatedTableData = (tableData.data ?? []).slice(0, 5);
  const {openDrawer} = useDrawer();
  const viewAllButtonRef = useRef<HTMLButtonElement>(null);
  const sharedHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const traceId = event.contexts?.trace?.trace_id;
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
    if (shouldOpenDrawer && traceId) {
      const expandedLogId = location.query.expandedLogId as string | undefined;

      openDrawer(
        () => (
          <LogsQueryParamsProvider
            analyticsPageSource={LogsAnalyticsPageSource.ISSUE_DETAILS}
            source="state"
            freeze={traceId ? {traceId} : undefined}
          >
            <LogsPageDataProvider disabled={!traceId}>
              <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
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
              </TraceItemAttributeProvider>
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
  }, [location.query, traceId, group, event, project, openDrawer, navigate, location]);
  if (!feature) {
    return null;
  }
  if (!traceId) {
    // If there isn't a traceId (eg. profiling issue), we shouldn't show logs since they are trace specific.
    // We may change this in the future if we have a trace-group or we generate trace sids for these issue types.
    return null;
  }
  if (!tableData?.data || (tableData.data.length === 0 && logsSearch.isEmpty())) {
    // Like breadcrumbs, we don't show the logs section if there are no logs.
    return null;
  }
  return (
    <InterimSection
      key="logs"
      type={SectionKey.LOGS}
      title={t('Logs')}
      data-test-id="logs-data-section"
    >
      <SmallTableContentWrapper>
        <SmallTable>
          <TableBody>
            {abbreviatedTableData?.map((row, index) => (
              <LogRowContent
                dataRow={row}
                meta={tableData.meta}
                highlightTerms={[]}
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
      </SmallTableContentWrapper>
    </InterimSection>
  );
}

const SmallTable = styled('table')`
  display: grid;
  grid-template-columns: 15px auto 1fr;
`;

const SmallTableContentWrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;
