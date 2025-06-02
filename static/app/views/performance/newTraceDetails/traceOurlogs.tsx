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
import {
  LogsPageDataProvider,
  useLogsPageDataQueryResult,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LogsPageParamsProvider,
  useLogsSearch,
  useSetLogsSearch,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {LogsTable} from 'sentry/views/explore/logs/tables/logsTable';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceContextSectionKeys} from 'sentry/views/performance/newTraceDetails/traceHeader/scrollToSectionLinks';
import {useHasTraceTabsUI} from 'sentry/views/performance/newTraceDetails/useHasTraceTabsUI';

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
  const tableData = useLogsPageDataQueryResult();
  const logsSearch = useLogsSearch();
  const hasTraceTabsUi = useHasTraceTabsUI();

  if (hasTraceTabsUi) {
    return (
      <StyledPanel>
        <LogsSectionContent scrollContainer={scrollContainer} />
      </StyledPanel>
    );
  }

  if (!tableData || (tableData.data?.length === 0 && logsSearch.isEmpty())) {
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
      <LogsSectionContent scrollContainer={scrollContainer} />
    </FoldSection>
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
