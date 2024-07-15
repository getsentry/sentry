import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  DEFAULT_INDEXED_INTERACTION_SORT,
  type InteractionSpanSampleRowWithScore,
  SORTABLE_INDEXED_INTERACTION_FIELDS,
} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useWebVitalsSort} from 'sentry/views/insights/browser/webVitals/utils/useWebVitalsSort';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanIndexedField} from 'sentry/views/insights/types';

export function useInpSpanSamplesWebVitalsQuery({
  transaction,
  limit,
  enabled,
  filters = {},
  sortName,
  browserTypes,
}: {
  limit: number;
  browserTypes?: BrowserType[];
  enabled?: boolean;
  filters?: {[key: string]: string[] | string | number | undefined};
  sortName?: string;
  transaction?: string;
}) {
  const filteredSortableFields = SORTABLE_INDEXED_INTERACTION_FIELDS;
  const sort = useWebVitalsSort({
    sortName,
    defaultSort: DEFAULT_INDEXED_INTERACTION_SORT,
    sortableFields: filteredSortableFields as unknown as string[],
  });

  const mutableSearch = MutableSearch.fromQueryObject({
    has: 'message',
    [`!${SpanIndexedField.SPAN_DESCRIPTION}`]: '<unknown>',
    'span.op': 'ui.interaction.click',
    'measurements.score.weight.inp': '>0',
    ...filters,
  });
  if (transaction !== undefined) {
    mutableSearch.addFilterValue(SpanIndexedField.ORIGIN_TRANSACTION, transaction);
  }
  if (browserTypes) {
    mutableSearch.addDisjunctionFilterValues(SpanIndexedField.BROWSER_NAME, browserTypes);
  }

  const {data, isLoading, ...rest} = useSpansIndexed(
    {
      search: mutableSearch,
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
    },
    'api.performance.browser.web-vitals.spans'
  );
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
