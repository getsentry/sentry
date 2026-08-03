import type React from 'react';
import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Panel} from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {useLogItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {HiddenLogSearchFields} from 'sentry/views/explore/logs/constants';
import {useLogsFrozenTraceIds} from 'sentry/views/explore/logs/logsFrozenContext';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {useLogsSearchQueryBuilderProps} from 'sentry/views/explore/logs/useLogsSearchQueryBuilderProps';
import {
  adjustLogTraceID,
  createErrorLogRow,
  getLogsUrl,
} from 'sentry/views/explore/logs/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

type ProviderProps = {
  children: React.ReactNode;
};

type PageDataProviderProps = ProviderProps & {
  disabled?: boolean;
};

export function TraceViewLogsQueryParamsProvider({
  traceSlug,
  children,
}: ProviderProps & {traceSlug: string}) {
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.TRACE_DETAILS}
      source="location"
      freeze={{traceId: traceSlug}}
    >
      {children}
    </LogsQueryParamsProvider>
  );
}

export function TraceViewLogsPageDataProvider({
  children,
  disabled,
}: PageDataProviderProps) {
  return <LogsPageDataProvider disabled={disabled}>{children}</LogsPageDataProvider>;
}

interface TraceViewLogsSectionProps {
  errors?: TraceTree.TraceErrorIssue[];
  fallbackTimestampSeconds?: number;
}

export function TraceViewLogsSection({
  errors = [],
  fallbackTimestampSeconds = 0,
}: TraceViewLogsSectionProps) {
  return (
    <StyledPanel>
      <LogsSectionContent
        errors={errors}
        fallbackTimestampSeconds={fallbackTimestampSeconds}
      />
    </StyledPanel>
  );
}

function LogsSectionContent({
  errors,
  fallbackTimestampSeconds,
}: Required<TraceViewLogsSectionProps>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const traceIds = useLogsFrozenTraceIds();

  const injectedErrorRows = useMemo(
    () => errors.map(error => createErrorLogRow(error, fallbackTimestampSeconds)),
    [errors, fallbackTimestampSeconds]
  );

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useLogItemAttributes({}, 'string', HiddenLogSearchFields);
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useLogItemAttributes({}, 'number', HiddenLogSearchFields);
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useLogItemAttributes({}, 'boolean', HiddenLogSearchFields);

  const {tracesItemSearchQueryBuilderProps} = useLogsSearchQueryBuilderProps({
    booleanAttributes,
    numberAttributes,
    stringAttributes,
    booleanSecondaryAliases,
    numberSecondaryAliases,
    stringSecondaryAliases,
  });

  const traceId = traceIds?.[0] && adjustLogTraceID(traceIds[0]);
  const logsUrl = getLogsUrl({
    organization,
    selection,
    query: traceId ? `trace:${traceId}` : undefined,
  });

  return (
    <Fragment>
      <Flex gap="lg">
        <TraceItemSearchQueryBuilder
          {...tracesItemSearchQueryBuilderProps}
          placeholder={t('Search logs for this event')}
        />
        <LinkButton to={logsUrl}>{t('Open in Logs')}</LinkButton>
      </Flex>
      <TableContainer>
        <LogsInfiniteTable
          analyticsPageSource={LogsAnalyticsPageSource.TRACE_DETAILS}
          embedded
          injectedErrorRows={injectedErrorRows}
          showCellActions
          showExploreSimilarSpansLink
        />
      </TableContainer>
    </Fragment>
  );
}

const TableContainer = styled('div')`
  margin-top: ${p => p.theme.space.xl};
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

const StyledPanel = styled(Panel)`
  padding: ${p => p.theme.space.xl};
  padding-bottom: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;
