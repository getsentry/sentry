import type {ReactText} from 'react';

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {
  TransactionSampleRowWithScore,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import {
  DEFAULT_INDEXED_SORT,
  SORTABLE_INDEXED_FIELDS,
} from 'sentry/views/insights/browser/webVitals/types';
import {mapWebVitalToOrderBy} from 'sentry/views/insights/browser/webVitals/utils/mapWebVitalToOrderBy';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useWebVitalsSort} from 'sentry/views/insights/browser/webVitals/utils/useWebVitalsSort';
import {SpanIndexedField, type SubregionCode} from 'sentry/views/insights/types';

type Props = {
  transaction: string;
  browserTypes?: BrowserType[];
  enabled?: boolean;
  limit?: number;
  orderBy?: WebVitals | null;
  query?: string;
  sortName?: string;
  subregions?: SubregionCode[];
  webVital?: WebVitals;
  withProfiles?: boolean;
};

export const useTransactionSamplesWebVitalsScoresQuery = ({
  orderBy,
  limit,
  transaction,
  query,
  enabled,
  withProfiles,
  sortName,
  webVital,
  browserTypes,
  subregions,
}: Props) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const filteredSortableFields = SORTABLE_INDEXED_FIELDS;

  const sort = useWebVitalsSort({
    sortName,
    defaultSort: DEFAULT_INDEXED_SORT,
    sortableFields: filteredSortableFields as unknown as string[],
  });

  const mutableSearch = new MutableSearch([
    'transaction.op:pageload',
    'has:measurements.score.total',
  ]).addStringFilter(`transaction:"${transaction}"`);
  if (query) {
    mutableSearch.addStringMultiFilter(query);
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

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'id',
        'trace',
        'user.display',
        'transaction',
        'measurements.lcp',
        'measurements.fcp',
        'measurements.cls',
        'measurements.ttfb',
        'transaction.duration',
        'replayId',
        'timestamp',
        'profile.id',
        'project',
        'measurements.score.total',
        ...(webVital
          ? [`measurements.score.${webVital}`, `measurements.score.weight.${webVital}`]
          : []),
      ],
      name: 'Web Vitals',
      query: mutableSearch.formatString(),
      orderby: mapWebVitalToOrderBy(orderBy) ?? withProfiles ? '-profile.id' : undefined,
      version: 2,
    },
    pageFilters.selection
  );

  eventView.sorts = [sort];

  const {
    data,
    isPending,
    isLoading: _,
    ...rest
  } = useDiscoverQuery({
    eventView,
    limit: limit ?? 50,
    location,
    orgSlug: organization.slug,
    options: {
      enabled,
      refetchOnWindowFocus: false,
    },
    referrer: 'api.performance.browser.web-vitals.transaction',
  });

  const toNumber = (item: ReactText) => (item ? parseFloat(item.toString()) : undefined);
  const tableData: TransactionSampleRowWithScore[] =
    !isPending && data?.data.length
      ? (data.data.map(
          row => ({
            id: row.id?.toString(),
            trace: row.trace?.toString(),
            'user.display': row['user.display']?.toString(),
            transaction: row.transaction?.toString(),
            'measurements.lcp': toNumber(row['measurements.lcp']!),
            'measurements.fcp': toNumber(row['measurements.fcp']!),
            'measurements.cls': toNumber(row['measurements.cls']!),
            'measurements.ttfb': toNumber(row['measurements.ttfb']!),
            'transaction.duration': toNumber(row['transaction.duration']!),
            replayId: row.replayId?.toString(),
            'profile.id': row['profile.id']?.toString(),
            projectSlug: row.project?.toString(),
            timestamp: row.timestamp?.toString(),
            totalScore: Math.round(
              (toNumber(row['measurements.score.total']!) ?? 0) * 100
            ),
            ...(webVital
              ? {
                  [`${webVital}Score`]: Math.round(
                    ((toNumber(row[`measurements.score.${webVital}`]!) ?? 0) /
                      (toNumber(row[`measurements.score.weight.${webVital}`]!) ?? 0)) *
                      100
                  ),
                  [`${webVital}Weight`]: Math.round(
                    (toNumber(row[`measurements.score.weight.${webVital}`]!) ?? 0) * 100
                  ),
                }
              : {}),
          })
          // TODO: Discover doesn't let us query more than 20 fields and we're hitting that limit.
          // Clean up the types to account for this so we don't need to do this casting.
        ) as unknown as TransactionSampleRowWithScore[])
      : [];

  return {
    data: tableData,
    isLoading: isPending,
    ...rest,
  };
};
