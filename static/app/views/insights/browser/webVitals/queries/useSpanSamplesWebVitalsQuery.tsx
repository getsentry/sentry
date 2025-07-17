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
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields, type SubregionCode} from 'sentry/views/insights/types';

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
    [`!${SpanFields.SPAN_DESCRIPTION}`]: '<unknown>',
  });
  if (transaction !== undefined) {
    mutableSearch.addFilterValue(SpanFields.TRANSACTION, transaction);
  }
  if (browserTypes) {
    mutableSearch.addDisjunctionFilterValues(SpanFields.BROWSER_NAME, browserTypes);
  }
  if (subregions) {
    mutableSearch.addDisjunctionFilterValues(SpanFields.USER_GEO_SUBREGION, subregions);
  }

  let field: SpanFields | undefined;
  let ratioField: SpanFields | undefined;
  switch (webVital) {
    case 'lcp':
      field = SpanFields.LCP;
      ratioField = SpanFields.LCP_SCORE_RATIO;
      break;
    case 'cls':
      field = SpanFields.CLS;
      ratioField = SpanFields.CLS_SCORE_RATIO;
      break;
    case 'fcp':
      field = SpanFields.FCP;
      ratioField = SpanFields.FCP_SCORE_RATIO;
      break;
    case 'ttfb':
      field = SpanFields.TTFB;
      ratioField = SpanFields.TTFB_SCORE_RATIO;
      break;
    case 'inp':
    default:
      field = SpanFields.INP;
      ratioField = SpanFields.INP_SCORE_RATIO;
      break;
  }

  const {data, isPending, ...rest} = useSpans(
    {
      search: `${mutableSearch.formatString()} ${filter}`,
      sorts: [sort],
      fields: [
        ...(field && ratioField ? [field, ratioField] : []),
        SpanFields.TOTAL_SCORE,
        SpanFields.TRACE,
        SpanFields.PROFILE_ID,
        SpanFields.PROFILEID,
        SpanFields.REPLAY_ID,
        SpanFields.REPLAYID,
        SpanFields.USER_EMAIL,
        SpanFields.USER_USERNAME,
        SpanFields.USER_ID,
        SpanFields.USER_IP,
        SpanFields.PROJECT,
        SpanFields.SPAN_DESCRIPTION,
        SpanFields.TIMESTAMP,
        SpanFields.SPAN_SELF_TIME,
        SpanFields.TRANSACTION,
        SpanFields.SPAN_OP,
        SpanFields.LCP_ELEMENT,
        SpanFields.CLS_SOURCE,
        SpanFields.ID,
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
            'user.display':
              row[SpanFields.USER_EMAIL] ??
              row[SpanFields.USER_USERNAME] ??
              row[SpanFields.USER_ID] ??
              row[SpanFields.USER_IP],
            replayId: row[SpanFields.REPLAY_ID] ?? row[SpanFields.REPLAYID],
            'profile.id': row[SpanFields.PROFILEID] ?? row[SpanFields.PROFILE_ID],
            totalScore: Math.round((row[`measurements.score.total`] ?? 0) * 100),
            inpScore: Math.round((row[SpanFields.INP_SCORE_RATIO] ?? 0) * 100),
            lcpScore: Math.round((row[SpanFields.LCP_SCORE_RATIO] ?? 0) * 100),
            clsScore: Math.round((row[SpanFields.CLS_SCORE_RATIO] ?? 0) * 100),
            fcpScore: Math.round((row[SpanFields.FCP_SCORE_RATIO] ?? 0) * 100),
            ttfbScore: Math.round((row[SpanFields.TTFB_SCORE_RATIO] ?? 0) * 100),
            projectSlug: row[SpanFields.PROJECT],
          };
        })
      : [];
  return {
    data: tableData,
    isPending,
    ...rest,
  };
}
