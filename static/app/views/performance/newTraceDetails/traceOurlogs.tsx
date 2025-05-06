import type React from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
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
import type {UseExploreLogsTableResult} from 'sentry/views/explore/logs/useLogsQuery';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceContextSectionKeys} from 'sentry/views/performance/newTraceDetails/traceHeader/scrollToSectionLinks';

type UseTraceViewLogsDataProps = {
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
  const tableData = useLogsPageData();
  if (!tableData?.logsData || tableData.logsData.data.length === 0) {
    return null;
  }
  return (
    <FoldSection
      sectionKey={TraceContextSectionKeys.LOGS as string as SectionKey}
      title={t('Logs')}
      data-test-id="logs-data-section"
      initialCollapse={false}
      disableCollapsePersistence
    >
      <LogsSectionContent tableData={tableData.logsData} />
    </FoldSection>
  );
}

function LogsSectionContent({tableData}: {tableData: UseExploreLogsTableResult}) {
  const organization = useOrganization();
  const setLogsQuery = useSetLogsQuery();
  const logsSearch = useLogsSearch();

  return (
    <Fragment>
      <SearchQueryBuilder
        searchOnChange={organization.features.includes('ui-search-on-change')}
        placeholder={t('Search logs for this event')}
        filterKeys={{}}
        getTagValues={() => new Promise<string[]>(() => [])}
        initialQuery={logsSearch.formatString()}
        searchSource="ourlogs"
        onSearch={setLogsQuery}
      />
      <TableContainer>
        <LogsTable tableData={tableData} showHeader={false} />
      </TableContainer>
    </Fragment>
  );
}

const TableContainer = styled('div')`
  margin-top: ${space(2)};
`;
