import type React from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Panel} from 'sentry/components/panels/panel';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useOrganization} from 'sentry/utils/useOrganization';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {useLogsFrozenTraceIds} from 'sentry/views/explore/logs/logsFrozenContext';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {adjustLogTraceID, getLogsUrl} from 'sentry/views/explore/logs/utils';
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
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const traceIds = useLogsFrozenTraceIds();
  const setLogsQuery = useSetQueryParamsQuery();
  const logsSearch = useQueryParamsSearch();

  const traceId = traceIds?.[0] && adjustLogTraceID(traceIds[0]);
  const logsUrl = getLogsUrl({
    organization,
    selection,
    query: traceId ? `trace:${traceId}` : undefined,
  });

  return (
    <Fragment>
      <Flex gap="lg">
        <SearchQueryBuilder
          placeholder={t('Search logs for this event')}
          filterKeys={{}}
          getTagValues={() => new Promise<string[]>(() => [])}
          initialQuery={logsSearch.formatString()}
          searchSource="ourlogs"
          onSearch={query => setLogsQuery(query)}
        />
        <LinkButton to={logsUrl}>{t('Open in Logs')}</LinkButton>
      </Flex>
      <TableContainer>
        <LogsInfiniteTable embedded scrollContainer={scrollContainer} />
      </TableContainer>
    </Fragment>
  );
}

const TableContainer = styled('div')`
  margin-top: ${p => p.theme.space.xl};
`;

const StyledPanel = styled(Panel)`
  padding: ${p => p.theme.space.xl};
  margin: 0;
`;
