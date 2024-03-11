import {
  DEFAULT_INDEXED_INTERACTION_SORT,
  type InteractionSpanSampleRowWithScore,
  SORTABLE_INDEXED_INTERACTION_FIELDS,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';
import {
  type Filters,
  useIndexedSpans,
} from 'sentry/views/starfish/queries/useIndexedSpans';
import {SpanIndexedField} from 'sentry/views/starfish/types';

export function useInpSpanSamplesWebVitalsQuery({
  transaction,
  limit,
  enabled,
  filters = {},
  sortName,
}: {
  limit: number;
  enabled?: boolean;
  filters?: Filters;
  sortName?: string;
  transaction?: string;
}) {
  const filteredSortableFields = SORTABLE_INDEXED_INTERACTION_FIELDS;
  const sort = useWebVitalsSort({
    sortName,
    defaultSort: DEFAULT_INDEXED_INTERACTION_SORT,
    sortableFields: filteredSortableFields as unknown as string[],
  });
  const {data, isLoading, ...rest} = useIndexedSpans({
    filters: {
      'span.op': 'ui.interaction.click',
      'measurements.score.weight.inp': '>0',
      ...(transaction !== undefined
        ? {[SpanIndexedField.ORIGIN_TRANSACTION]: transaction}
        : {}),
      ...filters,
    },
    sorts: [sort],
    fields: [
      SpanIndexedField.INP,
      SpanIndexedField.INP_SCORE,
      SpanIndexedField.INP_SCORE_WEIGHT,
      SpanIndexedField.TOTAL_SCORE,
      SpanIndexedField.ID,
      SpanIndexedField.TIMESTAMP,
      SpanIndexedField.PROFILE_ID,
      SpanIndexedField.REPLAY_ID,
      SpanIndexedField.USER,
      SpanIndexedField.ORIGIN_TRANSACTION,
      SpanIndexedField.PROJECT,
      SpanIndexedField.BROWSER_NAME,
      SpanIndexedField.SPAN_SELF_TIME,
      SpanIndexedField.SPAN_DESCRIPTION,
    ],
    enabled,
    limit,
    referrer: 'api.performance.browser.web-vitals.spans',
  });
  const tableData: InteractionSpanSampleRowWithScore[] =
    !isLoading && data?.length
      ? data.map(row => {
          return {
            ...row,
            'measurements.inp': row[SpanIndexedField.INP],
            'user.display': row[SpanIndexedField.USER],
            replayId: row[SpanIndexedField.REPLAY_ID],
            'profile.id': row[SpanIndexedField.PROFILE_ID],
            inpScore: Math.round(
              ((row[`measurements.score.inp`] ?? 0) /
                (row[`measurements.score.weight.inp`] ?? 0)) *
                100
            ),
            totalScore: Math.round(row[`measurements.score.total`] ?? 0),
            projectSlug: row[SpanIndexedField.PROJECT],
          };
        })
      : [];
  return {
    data: tableData,
    isLoading,
    ...rest,
  };
}
