import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import {IconWarning} from '@sentry/icons/iconWarning';
import moment from 'moment-timezone';

import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {Count} from 'sentry/components/count';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {PerformanceDuration} from 'sentry/components/performanceDuration';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import type {NewQuery, Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {EventView} from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useQueryParamsQuery} from 'sentry/views/explore//queryParams/context';
import {getBodySearchTerms} from 'sentry/views/explore/bodySearchTerms';
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
import {SpanTableCell} from 'sentry/views/explore/tables/tracesTable/styles';
import type {
  SpanResult,
  SpanResults,
} from 'sentry/views/explore/tables/tracesTable/types';
import {getSecondaryNameFromSpan} from 'sentry/views/explore/tables/tracesTable/utils';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

const ONE_MINUTE = 60 * 1000; // in milliseconds

const SPAN_TABLE_COLUMNS: TableColumnConfig[] = [
  {key: 'id', width: 'min-content'},
  {key: 'description', width: 'auto'},
  {key: 'breakdown', width: 'min-content'},
  {key: 'duration', width: 'min-content'},
  {key: 'timestamp', width: 'min-content'},
];

export function TraceSpansTable({trace}: {trace: TraceResult}) {
  const organization = useOrganization();

  const query = useQueryParamsQuery();

  const {data, isPending, isError} = useSpans({
    query,
    trace,
  });

  const spans = useMemo(() => data?.data ?? [], [data]);

  const [caseInsensitive] = useCaseInsensitivity();

  const highlightTerms = useMemo(
    () => getBodySearchTerms(new MutableSearch(query), 'span.description'),
    [query]
  );

  const showErrorState = useMemo(() => {
    return !isPending && isError;
  }, [isPending, isError]);

  const hasData = useMemo(() => {
    return !isPending && !showErrorState && spans.length > 0;
  }, [spans, isPending, showErrorState]);

  return (
    <SimpleTable.Row>
      <SpanTableCell>
        <SimpleTable
          aria-label={t('Spans in trace')}
          columns={SPAN_TABLE_COLUMNS}
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>{t('Span ID')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Span Description')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell aria-label={t('Span Breakdown')} />
              <SimpleTable.HeaderCell align="right">
                {t('Span Duration')}
              </SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell align="right">
                {t('Timestamp')}
              </SimpleTable.HeaderCell>
            </SimpleTable.HeaderRow>
          }
        >
          {isPending && <SimpleTable.Loading />}
          {isError && ( // TODO: need an error state
            <SimpleTable.Empty>
              <IconWarning
                data-test-id="spans-error-indicator"
                variant="muted"
                size="lg"
              />
            </SimpleTable.Empty>
          )}
          {data?.data.map(span => (
            <SpanRow
              organization={organization}
              key={span.id}
              span={span}
              trace={trace}
              highlightTerms={highlightTerms}
              caseSensitiveHighlighting={!caseInsensitive}
            />
          ))}
          {hasData && spans.length < trace.matchingSpans && (
            <SimpleTable.Row>
              <SimpleTable.RowCell column="1 / -1">
                <Text variant="muted">
                  {tct('[more][space]more [matching]spans can be found in the trace.', {
                    more: <Count value={trace.matchingSpans - spans.length} />,
                    space: <Fragment>&nbsp;</Fragment>,
                    matching: query ? 'matching ' : '',
                  })}
                </Text>
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          )}
        </SimpleTable>
      </SpanTableCell>
    </SimpleTable.Row>
  );
}

function SpanRow({
  organization,
  span,
  trace,
  highlightTerms,
  caseSensitiveHighlighting,
}: {
  caseSensitiveHighlighting: boolean;
  highlightTerms: string[];
  organization: Organization;
  span: SpanResult<Field>;
  trace: TraceResult;
}) {
  const theme = useTheme();
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
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
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <SpanDescriptionRenderer
          span={span}
          highlightTerms={highlightTerms}
          caseSensitiveHighlighting={caseSensitiveHighlighting}
        />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
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
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <PerformanceDuration milliseconds={span['span.duration']} abbreviation />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <SpanTimeRenderer
          timestamp={span['precise.finish_ts'] * 1000}
          tooltipShowSeconds
        />
      </SimpleTable.RowCell>
    </SimpleTable.Row>
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
