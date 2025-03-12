import {Fragment} from 'react';
import styled from '@emotion/styled';

import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {
  LogsPageParamsProvider,
  type LogsPageParamsProviderProps,
  useLogsSearch,
  useSetLogsQuery,
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
} & Omit<LogsPageParamsProviderProps, 'children'>) {
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
        isOnEmbeddedView={isOnEmbeddedView}
        limitToTraceId={limitToTraceId}
      >
        <LogsSectionContent tableData={tableData} />
      </LogsPageParamsProvider>
    </InterimSection>
  );
}

function LogsSectionContent({tableData}: {tableData: UseExploreLogsTableResult}) {
  const setLogsQuery = useSetLogsQuery();
  const logsSearch = useLogsSearch();
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
        <LogsTable tableData={tableData} />
      </TableContainer>
    </Fragment>
  );
}

const TableContainer = styled('div')`
  margin-top: ${space(2)};
`;
