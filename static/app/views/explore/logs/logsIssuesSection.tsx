import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  LogsPageParamsProvider,
  useLogsSearch,
  useSetLogsQuery,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export function LogsIssuesSection() {
  return (
    <Feature features={['ourlogs-enabled']}>
      <InterimSection
        key="logs"
        type={SectionKey.LOGS}
        title={t('Logs')}
        data-test-id="logs-data-section"
      >
        <LogsPageParamsProvider>
          <LogsSectionContent />
        </LogsPageParamsProvider>
      </InterimSection>
    </Feature>
  );
}

function LogsSectionContent() {
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
        <LogsTable perPage={20} />
      </TableContainer>
    </Fragment>
  );
}

const TableContainer = styled('div')`
  margin-top: ${space(2)};
`;
