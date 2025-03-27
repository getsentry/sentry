import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
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
import {
  LogsPageParamsProvider,
  type LogsPageParamsProviderProps,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LogsIssueDrawer} from 'sentry/views/explore/logs/logsIssueDrawer';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {
  useExploreLogsTable,
  type UseExploreLogsTableResult,
} from 'sentry/views/explore/logs/useLogsQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export function LogsIssuesSection({
  initialCollapse,
  isOnEmbeddedView,
  limitToTraceId,
  event,
  project,
  group,
}: {
  event: Event;
  group: Group;
  initialCollapse: boolean;
  project: Project;
} & Omit<LogsPageParamsProviderProps, 'children' | 'analyticsPageSource'>) {
  const organization = useOrganization();
  const feature = organization.features.includes('ourlogs-enabled');
  const tableData = useExploreLogsTable({enabled: feature, limit: 10});
  const {openDrawer} = useDrawer();

  const onOpenLogsDrawer = useCallback(() => {
    trackAnalytics('logs.issue_details.drawer_opened', {
      organization,
    });
    openDrawer(
      () => (
        <LogsPageParamsProvider
          analyticsPageSource={LogsAnalyticsPageSource.ISSUE_DETAILS}
          isOnEmbeddedView
          limitToTraceId={limitToTraceId}
        >
          <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
            <LogsIssueDrawer group={group} event={event} project={project} />
          </TraceItemAttributeProvider>
        </LogsPageParamsProvider>
      ),
      {
        ariaLabel: 'logs drawer',
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
  if (tableData?.data?.length === 0) {
    // Like breadcrumbs, we don't show the logs section if there are no logs.
    return null;
  }
  return (
    <InterimSection
      key="logs"
      type={SectionKey.LOGS}
      title={t('Logs')}
      data-test-id="logs-data-section"
      initialCollapse={initialCollapse}
    >
      <LogsPageParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.ISSUE_DETAILS}
        isOnEmbeddedView={isOnEmbeddedView}
        limitToTraceId={limitToTraceId}
      >
        <LogsSectionContent tableData={tableData} openDrawer={onOpenLogsDrawer} />
      </LogsPageParamsProvider>
    </InterimSection>
  );
}

function LogsSectionContent({
  tableData,
  openDrawer,
}: {
  openDrawer: () => void;
  tableData: UseExploreLogsTableResult;
}) {
  return (
    <LogContentWrapper>
      <LogsTable showHeader={false} allowPagination={false} tableData={tableData} />
      <div>
        <Button
          icon={<IconChevron direction="right" />}
          aria-label={t('View more')}
          size="md"
          onClick={() => openDrawer()}
        >
          {t('View more')}
        </Button>
      </div>
    </LogContentWrapper>
  );
}

const LogContentWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
