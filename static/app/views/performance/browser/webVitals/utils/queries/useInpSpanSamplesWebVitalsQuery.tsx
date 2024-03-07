import type {InteractionSpanSampleRowWithScore} from 'sentry/views/performance/browser/webVitals/utils/types';
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
}: {
  limit: number;
  enabled?: boolean;
  filters?: Filters;
  transaction?: string;
}) {
  const {data, isLoading, ...rest} = useIndexedSpans({
    filters: {
      'span.op': 'ui.interaction.click',
      'measurements.score.weight.inp': '>0',
      ...(transaction !== undefined
        ? {[SpanIndexedField.ORIGIN_TRANSACTION]: transaction}
        : {}),
      ...filters,
    },
    sorts: [{field: SpanIndexedField.TIMESTAMP, kind: 'desc'}],
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
