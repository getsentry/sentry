import {t} from 'sentry/locale';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
import {
  LogsPageParamsProvider,
  type LogsPageParamsProviderProps,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {
  useExploreLogsTable,
  type UseExploreLogsTableResult,
} from 'sentry/views/explore/logs/useLogsQuery';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export function LogsIssuesSection({
  initialCollapse,
  isOnEmbeddedView,
  limitToTraceId,
}: {
  initialCollapse: boolean;
} & Omit<LogsPageParamsProviderProps, 'children' | 'analyticsPageSource'>) {
  const organization = useOrganization();
  const feature = organization.features.includes('ourlogs-enabled');
  const tableData = useExploreLogsTable({enabled: feature, limit: 10});
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
        <LogsSectionContent tableData={tableData} />
      </LogsPageParamsProvider>
    </InterimSection>
  );
}

function LogsSectionContent({tableData}: {tableData: UseExploreLogsTableResult}) {
  return <LogsTable showHeader={false} tableData={tableData} />;
}
