import type {ReactText} from 'react';

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {mapWebVitalToOrderBy} from 'sentry/views/performance/browser/webVitals/utils/mapWebVitalToOrderBy';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import type {
  TransactionSampleRowWithScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {
  DEFAULT_INDEXED_SORT,
  SORTABLE_INDEXED_FIELDS,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';

type Props = {
  transaction: string;
  enabled?: boolean;
  limit?: number;
  orderBy?: WebVitals | null;
  query?: string;
  sortName?: string;
  withProfiles?: boolean;
};

export const useTransactionRawSamplesWebVitalsQuery = ({
  orderBy,
  limit,
  transaction,
  query,
  enabled,
  withProfiles,
  sortName,
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

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'id',
        'user.display',
        'transaction',
        'trace',
        'measurements.lcp',
        'measurements.fcp',
        'measurements.cls',
        'measurements.ttfb',
        'measurements.fid',
        'transaction.duration',
        'replayId',
        'timestamp',
        'profile.id',
        'project',
      ],
      name: 'Web Vitals',
      query: new MutableSearch(['transaction.op:pageload', ...(query ? [query] : [])])
        .addStringFilter(`transaction:"${transaction}"`)
        .formatString(),
      orderby: mapWebVitalToOrderBy(orderBy) ?? withProfiles ? '-profile.id' : undefined,
      version: 2,
    },
    pageFilters.selection
  );

  eventView.sorts = [sort];

  const {data, isLoading, ...rest} = useDiscoverQuery({
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
    !isLoading && data?.data.length
      ? data.data
          .map(row => ({
            id: row.id?.toString(),
            trace: row.trace?.toString(),
            'user.display': row['user.display']?.toString(),
            transaction: row.transaction?.toString(),
            'measurements.lcp': toNumber(row['measurements.lcp']),
            'measurements.fcp': toNumber(row['measurements.fcp']),
            'measurements.cls': toNumber(row['measurements.cls']),
            'measurements.ttfb': toNumber(row['measurements.ttfb']),
            'measurements.fid': toNumber(row['measurements.fid']),
            'transaction.duration': toNumber(row['transaction.duration']),
            replayId: row.replayId?.toString(),
            'profile.id': row['profile.id']?.toString(),
            projectSlug: row.project?.toString(),
            timestamp: row.timestamp?.toString(),
          }))
          .map(row => {
            const {totalScore, clsScore, fcpScore, lcpScore, ttfbScore, fidScore} =
              calculatePerformanceScore({
                lcp: row['measurements.lcp'],
                fcp: row['measurements.fcp'],
                cls: row['measurements.cls'],
                ttfb: row['measurements.ttfb'],
                fid: row['measurements.fid'],
              });
            return {
              ...row,
              totalScore: totalScore ?? 0,
              clsScore: clsScore ?? 0,
              fcpScore: fcpScore ?? 0,
              lcpScore: lcpScore ?? 0,
              ttfbScore: ttfbScore ?? 0,
              fidScore: fidScore ?? 0,
              // Fake INP data using FID data
              // TODO(edwardgou): Remove this once INP is queryable in discover
              inpScore: fidScore ?? 0,
            };
          })
      : [];

  return {
    data: tableData,
    isLoading,
    ...rest,
  };
};
