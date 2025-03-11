import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  LogsPageParamsProvider,
  type LogsPageParamsProviderProps,
  useLogsSearch,
  useSetLogsQuery,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {useExploreLogsTable} from 'sentry/views/explore/logs/useLogsQuery';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export function LogsIssuesSection({
  initialCollapse,
  isIssuesDetailView,
  limitToTraceId: traceId,
}: {
  initialCollapse: boolean;
} & Omit<LogsPageParamsProviderProps, 'children'>) {
  return (
    <Feature features={['ourlogs-enabled']}>
      <InterimSection
        key="logs"
        type={SectionKey.LOGS}
        title={t('Logs')}
        data-test-id="logs-data-section"
        initialCollapse={initialCollapse}
      >
        <LogsPageParamsProvider
          isIssuesDetailView={isIssuesDetailView}
          limitToTraceId={traceId}
        >
          <LogsSectionContent />
        </LogsPageParamsProvider>
      </InterimSection>
    </Feature>
  );
}

function LogsSectionContent() {
  const setLogsQuery = useSetLogsQuery();
  const logsSearch = useLogsSearch();
  const tableData = useExploreLogsTable({});
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
