import type React from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {
  LogsPageDataProvider,
  useLogsPageData,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LogsPageParamsProvider,
  useLogsSearch,
  useSetLogsQuery,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceContextSectionKeys} from 'sentry/views/performance/newTraceDetails/traceHeader/scrollToSectionLinks';

export type UseTraceViewLogsDataProps = {
  children: React.ReactNode;
  traceSlug: string;
};

export function TraceViewLogsDataProvider({
  traceSlug,
  children,
}: UseTraceViewLogsDataProps) {
  return (
    <LogsPageParamsProvider
      isOnEmbeddedView
      limitToTraceId={traceSlug}
      analyticsPageSource={LogsAnalyticsPageSource.TRACE_DETAILS}
    >
      <LogsPageDataProvider>{children}</LogsPageDataProvider>
    </LogsPageParamsProvider>
  );
}

export function TraceViewLogsSection() {
  return (
    <InterimSection
      key="logs"
      type={TraceContextSectionKeys.LOGS}
      title={t('Logs')}
      data-test-id="logs-data-section"
      initialCollapse={false}
    >
      <LogsSectionContent />
    </InterimSection>
  );
}

function LogsSectionContent() {
  const setLogsQuery = useSetLogsQuery();
  const logsSearch = useLogsSearch();
  const tableData = useLogsPageData();
  if (!tableData?.logsData) {
    return null;
  }
  return (
    <Fragment>
      <SearchQueryBuilder
        placeholder={t('Search logs for this event')}
        filterKeys={{}}
        getTagValues={() => new Promise<string[]>(() => [])}
        initialQuery={logsSearch.formatString()}
        searchSource="ourlogs"
        onSearch={setLogsQuery}
      />
      <TableContainer>
        <LogsTable tableData={tableData.logsData} showHeader={false} />
      </TableContainer>
    </Fragment>
  );
}

const TableContainer = styled('div')`
  margin-top: ${space(2)};
`;
