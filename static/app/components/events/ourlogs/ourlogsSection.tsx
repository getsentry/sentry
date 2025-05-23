import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {OurlogsDrawer} from 'sentry/components/events/ourlogs/ourlogsDrawer';
import useDrawer from 'sentry/components/globalDrawer';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
import {useLogsPageData} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LogsPageParamsProvider,
  useLogsSearch,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LogsTable} from 'sentry/views/explore/logs/tables/logsTable';
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
  return (
    <LogsPageParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.ISSUE_DETAILS}
      isTableFrozen
      blockRowExpanding
      limitToTraceId={event.contexts?.trace?.trace_id}
    >
      <OurlogsSectionContent event={event} group={group} project={project} />
    </LogsPageParamsProvider>
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
  const feature = organization.features.includes('ourlogs-enabled');
  const tableData = useLogsPageData().logsQueryResult;
  const logsSearch = useLogsSearch();
  const {openDrawer} = useDrawer();

  const limitToTraceId = event.contexts?.trace?.trace_id;
  const onOpenLogsDrawer = useCallback(() => {
    trackAnalytics('logs.issue_details.drawer_opened', {
      organization,
    });
    openDrawer(
      () => (
        <LogsPageParamsProvider
          analyticsPageSource={LogsAnalyticsPageSource.ISSUE_DETAILS}
          isTableFrozen
          limitToTraceId={limitToTraceId}
        >
          <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
            <OurlogsDrawer group={group} event={event} project={project} />
          </TraceItemAttributeProvider>
        </LogsPageParamsProvider>
      ),
      {
        ariaLabel: 'logs drawer',
        drawerKey: 'logs-issue-drawer',
      }
    );
  }, [group, event, project, openDrawer, organization, limitToTraceId]);
  if (!feature) {
    return null;
  }
  if (!limitToTraceId) {
    // If there isn't a traceId (eg. profiling issue), we shouldn't show logs since they are trace specific.
    // We may change this in the future if we have a trace-group or we generate trace sids for these issue types.
    return null;
  }
  if (!tableData || (tableData.data?.length === 0 && logsSearch.isEmpty())) {
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
      <LogContentWrapper onClick={() => onOpenLogsDrawer()}>
        <LogsTable showHeader={false} allowPagination={false} />
        {tableData.data && tableData.data.length > 5 ? (
          <div>
            <Button
              icon={<IconChevron direction="right" />}
              aria-label={t('View more')}
              size="md"
              onClick={() => onOpenLogsDrawer()}
            >
              {t('View more')}
            </Button>
          </div>
        ) : null}
      </LogContentWrapper>
    </InterimSection>
  );
}

const LogContentWrapper = styled('button')`
  all: unset;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  pointer-events: auto;
  cursor: pointer;

  * {
    pointer-events: none !important;
    cursor: inherit !important;
  }
`;
