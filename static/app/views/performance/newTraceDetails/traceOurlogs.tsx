import type React from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {
  useQueryParamsSearch,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';

type UseTraceViewLogsDataProps = {
  children: React.ReactNode;
  traceSlug: string;
};

export function TraceViewLogsDataProvider({
  traceSlug,
  children,
}: UseTraceViewLogsDataProps) {
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.TRACE_DETAILS}
      source="state"
      freeze={{traceId: traceSlug}}
    >
      <LogsPageDataProvider>{children}</LogsPageDataProvider>
    </LogsQueryParamsProvider>
  );
}

export function TraceViewLogsSection({
  scrollContainer,
}: {
  scrollContainer: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <StyledPanel>
      <LogsSectionContent scrollContainer={scrollContainer} />
    </StyledPanel>
  );
}

function LogsSectionContent({
  scrollContainer,
}: {
  scrollContainer: React.RefObject<HTMLDivElement | null>;
}) {
  const setLogsQuery = useSetQueryParamsQuery();
  const logsSearch = useQueryParamsSearch();

  return (
    <Fragment>
      <SearchQueryBuilder
        placeholder={t('Search logs for this event')}
        filterKeys={{}}
        getTagValues={() => new Promise<string[]>(() => [])}
        initialQuery={logsSearch.formatString()}
        searchSource="ourlogs"
        onSearch={query => setLogsQuery(query)}
      />
      <TableContainer>
        <LogsInfiniteTable embedded scrollContainer={scrollContainer} />
      </TableContainer>
    </Fragment>
  );
}

const TableContainer = styled('div')`
  margin-top: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  padding: ${space(2)};
  margin: 0;
`;
