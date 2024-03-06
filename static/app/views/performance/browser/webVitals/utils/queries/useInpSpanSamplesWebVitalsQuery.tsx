import type {ReactText} from 'react';

import {
  type Filters,
  useIndexedSpans,
} from 'sentry/views/starfish/queries/useIndexedSpans';
import {SpanIndexedField, SpanMeasurements} from 'sentry/views/starfish/types';

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
      SpanMeasurements.INP,
      SpanMeasurements.INP_SCORE,
      SpanMeasurements.INP_SCORE_WEIGHT,
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
  const toNumber = (item: ReactText) => (item ? parseFloat(item.toString()) : undefined);
  const tableData =
    !isLoading && data?.length
      ? data.map(row => {
          return {
            ...row,
            'measurements.inp': row[SpanMeasurements.INP],
            'user.display': row[SpanIndexedField.USER],
            replayId: row[SpanIndexedField.REPLAY_ID],
            'profile.id': row[SpanIndexedField.PROFILE_ID],
            inpScore: Math.round(
              ((toNumber(row[`measurements.score.inp`]) ?? 0) /
                (toNumber(row[`measurements.score.weight.inp`]) ?? 0)) *
                100
            ),
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
