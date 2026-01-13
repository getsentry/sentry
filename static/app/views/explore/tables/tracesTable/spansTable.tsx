import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import moment from 'moment-timezone';

import Count from 'sentry/components/count';
import {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t, tct} from 'sentry/locale';
import type {NewQuery, Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useQueryParamsQuery} from 'sentry/views/explore//queryParams/context';
import type {TraceResult} from 'sentry/views/explore/hooks/useTraces';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';
import {FIELDS, SORTS, type Field} from 'sentry/views/explore/tables/tracesTable/data';
import {
  SpanBreakdownSliceRenderer,
  SpanDescriptionRenderer,
  SpanIdRenderer,
  SpanTimeRenderer,
  TraceBreakdownContainer,
} from 'sentry/views/explore/tables/tracesTable/fieldRenderers';
import {
  MoreMatchingSpans,
  SpanPanelContent,
  SpanTablePanelItem,
  StyledPanel,
  StyledPanelHeader,
  StyledPanelItem,
  StyledSpanPanelItem,
} from 'sentry/views/explore/tables/tracesTable/styles';
import type {
  SpanResult,
  SpanResults,
} from 'sentry/views/explore/tables/tracesTable/types';
import {getSecondaryNameFromSpan} from 'sentry/views/explore/tables/tracesTable/utils';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

const ONE_MINUTE = 60 * 1000; // in milliseconds

export function SpanTable({trace}: {trace: TraceResult}) {
  const organization = useOrganization();

  const query = useQueryParamsQuery();

  const {data, isPending, isError} = useSpans({
    query,
    trace,
  });

  const spans = useMemo(() => data?.data ?? [], [data]);

  const showErrorState = useMemo(() => {
    return !isPending && isError;
  }, [isPending, isError]);

  const hasData = useMemo(() => {
    return !isPending && !showErrorState && spans.length > 0;
  }, [spans, isPending, showErrorState]);

  return (
    <SpanTablePanelItem span={6} overflow>
      <StyledPanel>
        <SpanPanelContent>
          <StyledPanelHeader justify="start" lightText>
            {t('Span ID')}
          </StyledPanelHeader>
          <StyledPanelHeader justify="start" lightText>
            {t('Span Description')}
          </StyledPanelHeader>
          <StyledPanelHeader justify="end" lightText />
          <StyledPanelHeader justify="end" lightText>
            {t('Span Duration')}
          </StyledPanelHeader>
          <StyledPanelHeader justify="end" lightText>
            {t('Timestamp')}
          </StyledPanelHeader>
          {isPending && (
            <StyledPanelItem span={5} overflow>
              <LoadingIndicator />
            </StyledPanelItem>
          )}
          {isError && ( // TODO: need an error state
            <StyledPanelItem span={5} overflow>
              <EmptyStreamWrapper>
                <IconWarning variant="muted" size="lg" />
              </EmptyStreamWrapper>
            </StyledPanelItem>
          )}
          {data?.data.map(span => (
            <SpanRow
              organization={organization}
              key={span.id}
              span={span}
              trace={trace}
            />
          ))}
          {hasData && spans.length < trace.matchingSpans && (
            <MoreMatchingSpans span={5}>
              {tct('[more][space]more [matching]spans can be found in the trace.', {
                more: <Count value={trace.matchingSpans - spans.length} />,
                space: <Fragment>&nbsp;</Fragment>,
                matching: query ? 'matching ' : '',
              })}
            </MoreMatchingSpans>
          )}
        </SpanPanelContent>
      </StyledPanel>
    </SpanTablePanelItem>
  );
}

function SpanRow({
  organization,
  span,
  trace,
}: {
  organization: Organization;
  span: SpanResult<Field>;
  trace: TraceResult;
}) {
  const theme = useTheme();
  return (
    <Fragment>
      <StyledSpanPanelItem align="right">
        <SpanIdRenderer
          transactionId={span['transaction.id']}
          spanId={span.id}
          traceId={trace.trace}
          spanDescription={span['span.description']}
          spanOp={span['span.op']}
          spanProject={span.project}
          timestamp={span.timestamp}
          onClick={() =>
            trackAnalytics('trace_explorer.open_trace_span', {
              organization,
              source: 'new explore',
            })
          }
        />
      </StyledSpanPanelItem>
      <StyledSpanPanelItem align="left" overflow>
        <SpanDescriptionRenderer span={span} />
      </StyledSpanPanelItem>
      <StyledSpanPanelItem align="right">
        <TraceBreakdownContainer>
          <SpanBreakdownSliceRenderer
            sliceName={span.project}
            sliceSecondaryName={getSecondaryNameFromSpan(span)}
            sliceStart={Math.ceil(span['precise.start_ts'] * 1000)}
            sliceEnd={Math.floor(span['precise.finish_ts'] * 1000)}
            trace={trace}
            theme={theme}
          />
        </TraceBreakdownContainer>
      </StyledSpanPanelItem>
      <StyledSpanPanelItem align="right">
        <PerformanceDuration milliseconds={span['span.duration']} abbreviation />
      </StyledSpanPanelItem>

      <StyledSpanPanelItem align="right">
        <SpanTimeRenderer
          timestamp={span['precise.finish_ts'] * 1000}
          tooltipShowSeconds
        />
      </StyledSpanPanelItem>
    </Fragment>
  );
}

interface UseSpansOptions {
  query: string;
  trace: TraceResult;
}

function useSpans({query, trace}: UseSpansOptions): {
  data: SpanResults<(typeof FIELDS)[number]>;
  isError: boolean;
  isPending: boolean;
} {
  const {selection} = usePageFilters();
  const dataset = useSpansDataset();

  const eventView = useMemo(() => {
    const fields = [
      ...FIELDS.map(field =>
        field === 'transaction.id' ? 'transaction.span_id' : field
      ),
      ...SORTS.map(field =>
        field.startsWith('-') ? (field.substring(1) as Field) : (field as Field)
      ),
    ];

    const search = new MutableSearch(query);

    search.addFilterValues('trace', [trace.trace]);

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Span Samples',
      fields,
      orderby: SORTS,
      query: search.formatString(),
      version: 2,
      dataset,
      multiSort: true,
    };

    const pageFilters = {
      ...selection,
      datetime: {
        // give a 1 minute buffer on each side so that start != end
        start: getUtcDateString(moment(trace.start - ONE_MINUTE)),
        end: getUtcDateString(moment(trace.end + ONE_MINUTE)),
        period: null,
        utc: true,
      },
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, pageFilters);
  }, [dataset, query, selection, trace]);

  const result = useSpansQuery({
    eventView,
    initialData: [],
    limit: 10,
    referrer: 'api.trace-explorer.trace-spans-list',
    allowAggregateConditions: false,
    trackResponseAnalytics: false,
  });

  const data = useMemo(() => {
    return {
      meta: result.meta,
      data: (result.data ?? []).map(r => {
        const row = r as any;
        return {
          project: row.project,
          'transaction.id': row['transaction.span_id'],
          id: row.id,
          timestamp: row.timestamp,
          'sdk.name': row['sdk.name'],
          'span.op': row['span.op'],
          'span.description': row['span.description'],
          'span.duration': row['span.duration'],
          'span.status': row['span.status'],
          'span.self_time': row['span.self_time'],
          'precise.start_ts': row['precise.start_ts'],
          'precise.finish_ts': row['precise.finish_ts'],
          is_transaction: row.is_transaction,
        };
      }),
    };
  }, [result]);

  return {
    isPending: result.isPending,
    isError: result.isError,
    data,
  };
}
