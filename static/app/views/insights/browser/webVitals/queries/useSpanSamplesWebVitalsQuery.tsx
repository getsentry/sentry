import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  DEFAULT_INDEXED_SPANS_SORT,
  SORTABLE_INDEXED_FIELDS,
  SORTABLE_INDEXED_INTERACTION_FIELDS,
  type SpanSampleRowWithScore,
  type WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useWebVitalsSort} from 'sentry/views/insights/browser/webVitals/utils/useWebVitalsSort';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanIndexedField, type SubregionCode} from 'sentry/views/insights/types';

export const INTERACTION_SPANS_FILTER =
  'span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press]';

export const LCP_SPANS_FILTER =
  'span.op:[ui.webvital.lcp,pageload] (!measurements.score.weight.lcp:0)';

export const CLS_SPANS_FILTER =
  'span.op:[ui.webvital.cls,pageload] (!measurements.score.weight.cls:0)';

export const SPANS_FILTER =
  'span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.lcp,ui.webvital.cls,pageload]';

export function useSpanSamplesWebVitalsQuery({
  transaction,
  limit,
  enabled,
  filter = SPANS_FILTER,
  sortName,
  browserTypes,
  subregions,
  webVital = 'inp',
}: {
  limit: number;
  browserTypes?: BrowserType[];
  enabled?: boolean;
  filter?: string;
  sortName?: string;
  subregions?: SubregionCode[];
  transaction?: string;
  webVital?: WebVitals;
}) {
  const filteredSortableFields = [
    ...SORTABLE_INDEXED_FIELDS,
    ...SORTABLE_INDEXED_INTERACTION_FIELDS,
  ];
  const sort = useWebVitalsSort({
    sortName,
    defaultSort: DEFAULT_INDEXED_SPANS_SORT,
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

  let field: SpanIndexedField | undefined;
  let ratioField: SpanIndexedField | undefined;
  switch (webVital) {
    case 'lcp':
      field = SpanIndexedField.LCP;
      ratioField = SpanIndexedField.LCP_SCORE_RATIO;
      break;
    case 'cls':
      field = SpanIndexedField.CLS;
      ratioField = SpanIndexedField.CLS_SCORE_RATIO;
      break;
    case 'fcp':
      field = SpanIndexedField.FCP;
      ratioField = SpanIndexedField.FCP_SCORE_RATIO;
      break;
    case 'ttfb':
      field = SpanIndexedField.TTFB;
      ratioField = SpanIndexedField.TTFB_SCORE_RATIO;
      break;
    case 'inp':
    default:
      field = SpanIndexedField.INP;
      ratioField = SpanIndexedField.INP_SCORE_RATIO;
      break;
  }

  const {data, isPending, ...rest} = useSpansIndexed(
    {
      search: `${mutableSearch.formatString()} ${filter}`,
      sorts: [sort],
      fields: [
        ...(field && ratioField ? [field, ratioField] : []),
        SpanIndexedField.TOTAL_SCORE,
        SpanIndexedField.TRACE,
        SpanIndexedField.PROFILE_ID,
        SpanIndexedField.REPLAY,
        SpanIndexedField.USER_DISPLAY,
        SpanIndexedField.PROJECT,
        SpanIndexedField.SPAN_DESCRIPTION,
        SpanIndexedField.TIMESTAMP,
        SpanIndexedField.SPAN_SELF_TIME,
        SpanIndexedField.TRANSACTION,
        SpanIndexedField.SPAN_OP,
        SpanIndexedField.LCP_ELEMENT,
        SpanIndexedField.CLS_SOURCE,
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
            [`measurements.${webVital}`]: row[ratioField] > 0 ? row[field] : undefined,
            'user.display': row[SpanIndexedField.USER_DISPLAY],
            replayId: row[SpanIndexedField.REPLAY],
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
