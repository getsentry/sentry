import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  DEFAULT_INDEXED_INTERACTION_SORT,
  SORTABLE_INDEXED_FIELDS,
  SORTABLE_INDEXED_INTERACTION_FIELDS,
  type SpanSampleRowWithScore,
} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useWebVitalsSort} from 'sentry/views/insights/browser/webVitals/utils/useWebVitalsSort';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanIndexedField, type SubregionCode} from 'sentry/views/insights/types';

export const INTERACTION_SPANS_FILTER =
  'span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press]';

export const LCP_SPANS_FILTER =
  'span.op:[ui.webvitals.lcp,pageload] (!measurements.score.weight.lcp:0)';

export const CLS_SPANS_FILTER =
  'span.op:[ui.webvitals.cls,pageload] (!measurements.score.weight.cls:0)';

export const SPANS_FILTER =
  'span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvitals.lcp,ui.webvitals.cls,pageload] (!measurements.score.weight.inp:0 OR !measurements.score.weight.lcp:0 OR !measurements.score.weight.cls:0)';

export function useSpanSamplesWebVitalsQuery({
  transaction,
  limit,
  enabled,
  filter = SPANS_FILTER,
  sortName,
  browserTypes,
  subregions,
}: {
  limit: number;
  browserTypes?: BrowserType[];
  enabled?: boolean;
  filter?: string;
  sortName?: string;
  subregions?: SubregionCode[];
  transaction?: string;
}) {
  const filteredSortableFields = [
    ...SORTABLE_INDEXED_FIELDS,
    ...SORTABLE_INDEXED_INTERACTION_FIELDS,
  ];
  const sort = useWebVitalsSort({
    sortName,
    defaultSort: DEFAULT_INDEXED_INTERACTION_SORT,
    sortableFields: filteredSortableFields as unknown as string[],
  });

  const mutableSearch = MutableSearch.fromQueryObject({
    has: 'message',
    [`!${SpanIndexedField.SPAN_DESCRIPTION}`]: '<unknown>',
  });
  if (transaction !== undefined) {
    mutableSearch.addFilterValue(SpanIndexedField.TRANSACTION, transaction);
  }
  if (browserTypes) {
    mutableSearch.addDisjunctionFilterValues(SpanIndexedField.BROWSER_NAME, browserTypes);
  }
  if (subregions) {
    mutableSearch.addDisjunctionFilterValues(
      SpanIndexedField.USER_GEO_SUBREGION,
      subregions
    );
  }

  const {data, isPending, ...rest} = useSpansIndexed(
    {
      search: `${mutableSearch.formatString()} ${filter}`,
      sorts: [sort],
      fields: [
        SpanIndexedField.INP,
        SpanIndexedField.LCP,
        SpanIndexedField.CLS,
        SpanIndexedField.INP_SCORE_RATIO,
        SpanIndexedField.LCP_SCORE_RATIO,
        SpanIndexedField.CLS_SCORE_RATIO,
        SpanIndexedField.TOTAL_SCORE,
        SpanIndexedField.TRACE,
        SpanIndexedField.PROFILE_ID,
        SpanIndexedField.REPLAY_ID,
        SpanIndexedField.USER,
        SpanIndexedField.USER_EMAIL,
        SpanIndexedField.USER_USERNAME,
        SpanIndexedField.USER_ID,
        SpanIndexedField.USER_IP,
        SpanIndexedField.PROJECT,
        SpanIndexedField.SPAN_DESCRIPTION,
        SpanIndexedField.TIMESTAMP,
        SpanIndexedField.SPAN_SELF_TIME,
        SpanIndexedField.TRANSACTION,
      ],
      enabled,
      limit,
    },
    'api.performance.browser.web-vitals.spans'
  );
  const tableData: SpanSampleRowWithScore[] =
    !isPending && data?.length
      ? data.map(row => {
          return {
            ...row,
            'measurements.inp':
              row[SpanIndexedField.INP_SCORE_RATIO] > 0
                ? row[SpanIndexedField.INP]
                : undefined,
            'measurements.lcp':
              row[SpanIndexedField.LCP_SCORE_RATIO] > 0
                ? row[SpanIndexedField.LCP]
                : undefined,
            'measurements.cls':
              row[SpanIndexedField.CLS_SCORE_RATIO] > 0
                ? row[SpanIndexedField.CLS]
                : undefined,
            'user.display':
              [
                row[SpanIndexedField.USER_EMAIL],
                row[SpanIndexedField.USER_USERNAME],
                row[SpanIndexedField.USER_ID],
                row[SpanIndexedField.USER_IP],
                row[SpanIndexedField.USER],
              ].find(field => field && field !== '') ?? undefined,
            replayId: row[SpanIndexedField.REPLAY_ID],
            'profile.id': row[SpanIndexedField.PROFILE_ID],
            totalScore: Math.round((row[`measurements.score.total`] ?? 0) * 100),
            inpScore: Math.round((row[SpanIndexedField.INP_SCORE_RATIO] ?? 0) * 100),
            lcpScore: Math.round((row[SpanIndexedField.LCP_SCORE_RATIO] ?? 0) * 100),
            clsScore: Math.round((row[SpanIndexedField.CLS_SCORE_RATIO] ?? 0) * 100),
            projectSlug: row[SpanIndexedField.PROJECT],
          };
        })
      : [];
  return {
    data: tableData,
    isPending,
    ...rest,
  };
}
