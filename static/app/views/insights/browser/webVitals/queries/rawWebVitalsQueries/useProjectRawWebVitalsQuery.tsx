import type {Tag} from 'sentry/types/group';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/browser/webVitals/referrers';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields, type SubregionCode} from 'sentry/views/insights/types';

type Props = {
  browserTypes?: BrowserType[];
  subregions?: SubregionCode[];
  tag?: Tag;
  transaction?: string;
};

export const useProjectRawWebVitalsQuery = ({
  transaction,
  tag,
  browserTypes,
  subregions,
}: Props = {}) => {
  const search = new MutableSearch([]);
  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  if (tag) {
    search.addFilterValue(tag.key, tag.name);
  }
  if (subregions) {
    search.addDisjunctionFilterValues(SpanFields.USER_GEO_SUBREGION, subregions);
  }
  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanFields.BROWSER_NAME, browserTypes);
  }

  return useSpans(
    {
      search: [DEFAULT_QUERY_FILTER, search.formatString()].join(' ').trim(),
      limit: 50,
      fields: [
        `p75(${SpanFields.BROWSER_WEB_VITAL_LCP_VALUE})`,
        `p75(${SpanFields.BROWSER_WEB_VITAL_FCP_VALUE})`,
        `p75(${SpanFields.BROWSER_WEB_VITAL_CLS_VALUE})`,
        `p75(${SpanFields.BROWSER_WEB_VITAL_TTFB_VALUE})`,
        `p75(${SpanFields.BROWSER_WEB_VITAL_INP_VALUE})`,
        'count()',
      ],
    },
    Referrer.WEB_VITAL_PROJECT
  );
};
