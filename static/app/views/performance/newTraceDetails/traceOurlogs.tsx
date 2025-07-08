import type React from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LogsPageParamsProvider,
  useLogsSearch,
  useSetLogsSearch,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {LogsTable} from 'sentry/views/explore/logs/tables/logsTable';

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
      isTableFrozen
      limitToTraceId={traceSlug}
      analyticsPageSource={LogsAnalyticsPageSource.TRACE_DETAILS}
    >
      <LogsPageDataProvider>{children}</LogsPageDataProvider>
    </LogsPageParamsProvider>
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
  const organization = useOrganization();
  const setLogsSearch = useSetLogsSearch();
  const logsSearch = useLogsSearch();
  const hasInfiniteFeature = organization.features.includes('ourlogs-infinite-scroll');

  return (
    <Fragment>
      <SearchQueryBuilder
        searchOnChange={organization.features.includes('ui-search-on-change')}
        placeholder={t('Search logs for this event')}
        filterKeys={{}}
        getTagValues={() => new Promise<string[]>(() => [])}
        initialQuery={logsSearch.formatString()}
        searchSource="ourlogs"
        onSearch={query => setLogsSearch(new MutableSearch(query))}
      />
      <TableContainer>
        {hasInfiniteFeature ? (
          <LogsInfiniteTable showHeader={false} scrollContainer={scrollContainer} />
        ) : (
          <LogsTable showHeader={false} />
        )}
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
