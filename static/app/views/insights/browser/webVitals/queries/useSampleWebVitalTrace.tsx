import {defined} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import type {ProjectData} from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import {SPANS_FILTER} from 'sentry/views/insights/browser/webVitals/queries/useSpanSamplesWebVitalsQuery';
import {Referrer} from 'sentry/views/insights/browser/webVitals/referrers';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import decodeBrowserTypes from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields, type SubregionCode} from 'sentry/views/insights/types';

type Props = {
  transaction: string;
  webVital: WebVitals;
  enabled?: boolean;
  projectData?: ProjectData[];
};

function useSampleWebVitalTrace({
  transaction,
  projectData,
  webVital,
  enabled = true,
}: Props) {
  const location = useLocation();

  let field: SpanFields | undefined;
  switch (webVital) {
    case 'cls':
      field = SpanFields.CLS;
      break;
    case 'fcp':
      field = SpanFields.FCP;
      break;
    case 'ttfb':
      field = SpanFields.TTFB;
      break;
    case 'inp':
      field = SpanFields.INP;
      break;
    case 'lcp':
    default:
      field = SpanFields.LCP;
      break;
  }

  const browserTypes = decodeBrowserTypes(location.query[SpanFields.BROWSER_NAME]);
  const subregions = decodeList(
    location.query[SpanFields.USER_GEO_SUBREGION]
  ) as SubregionCode[];
  const p75Value = projectData?.[0]?.[`p75(measurements.${webVital})`];

  const search = new MutableSearch(SPANS_FILTER);
  search.addFilterValue(SpanFields.TRANSACTION, transaction);
  if (defined(p75Value)) {
    search.addStringFilter(`measurements.${webVital}:>=${p75Value}`);
  }
  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanFields.BROWSER_NAME, browserTypes);
  }
  if (subregions) {
    search.addDisjunctionFilterValues(SpanFields.USER_GEO_SUBREGION, subregions);
  }

  return useSpans(
    {
      search,
      sorts: [{field: `measurements.${webVital}`, kind: 'asc'}],
      fields: [SpanFields.TRACE, SpanFields.TIMESTAMP, field],
      enabled: defined(p75Value) && enabled,
      limit: 1, // We only need one sample to attach to the issue
    },
    Referrer.WEB_VITAL_SPANS
  );
}

// Unfortunately, we need to run separate queries for each web vital since we need a sample trace for each
// Theres no way to get 5 samples for 5 separate web vital conditions in a single query at the moment
export function useSampleWebVitalTraceParallel({
  transaction,
  projectData,
  enabled = true,
}: Omit<Props, 'webVital'>) {
  const {data: lcp, isLoading: isLcpLoading} = useSampleWebVitalTrace({
    transaction,
    projectData,
    webVital: 'lcp',
    enabled,
  });
  const {data: cls, isLoading: isClsLoading} = useSampleWebVitalTrace({
    transaction,
    projectData,
    webVital: 'cls',
    enabled,
  });
  const {data: fcp, isLoading: isFcpLoading} = useSampleWebVitalTrace({
    transaction,
    projectData,
    webVital: 'fcp',
    enabled,
  });
  const {data: ttfb, isLoading: isTtfbLoading} = useSampleWebVitalTrace({
    transaction,
    projectData,
    webVital: 'ttfb',
    enabled,
  });
  const {data: inp, isLoading: isInpLoading} = useSampleWebVitalTrace({
    transaction,
    projectData,
    webVital: 'inp',
    enabled,
  });
  const isLoading =
    isLcpLoading || isClsLoading || isFcpLoading || isTtfbLoading || isInpLoading;

  return {
    lcp: lcp?.[0],
    cls: cls?.[0],
    fcp: fcp?.[0],
    ttfb: ttfb?.[0],
    inp: inp?.[0],
    isLoading,
  };
}
