import {ReactText} from 'react';

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {mapWebVitalToOrderBy} from 'sentry/views/performance/browser/webVitals/utils/mapWebVitalToOrderBy';
import {
  TransactionSampleRowWithScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  transaction: string;
  enabled?: boolean;
  limit?: number;
  orderBy?: WebVitals | null;
  query?: string;
};

export const useTransactionSamplesWebVitalsQuery = ({
  orderBy,
  limit,
  transaction,
  query,
  enabled,
}: Props) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'id',
        'user.display',
        'transaction',
        'transaction.op',
        'measurements.lcp',
        'measurements.fcp',
        'measurements.cls',
        'measurements.ttfb',
        'measurements.fid',
        'transaction.duration',
        'replayId',
        'timestamp',
        'profile.id',
        'browser',
      ],
      name: 'Web Vitals',
      query: `transaction.op:pageload transaction:"${transaction}" ${query ? query : ''}`,
      orderby: mapWebVitalToOrderBy(orderBy),
      version: 2,
    },
    pageFilters.selection
  );

  const {data, isLoading, ...rest} = useDiscoverQuery({
    eventView,
    limit: limit ?? 50,
    location,
    orgSlug: organization.slug,
    options: {
      enabled: enabled && pageFilters.isReady,
      refetchOnWindowFocus: false,
    },
  });

  const toNumber = (item: ReactText) => (item ? parseFloat(item.toString()) : null);
  const tableData: TransactionSampleRowWithScore[] =
    !isLoading && data?.data.length
      ? data.data
          .map(row => ({
            id: row.id?.toString(),
            'user.display': row['user.display']?.toString(),
            transaction: row.transaction?.toString(),
            'transaction.op': row['transaction.op']?.toString(),
            browser: row.browser?.toString(),
            'measurements.lcp': toNumber(row['measurements.lcp']),
            'measurements.fcp': toNumber(row['measurements.fcp']),
            'measurements.cls': toNumber(row['measurements.cls']),
            'measurements.ttfb': toNumber(row['measurements.ttfb']),
            'measurements.fid': toNumber(row['measurements.fid']),
            'transaction.duration': toNumber(row['transaction.duration']),
            replayId: row.replayId?.toString(),
            'profile.id': row.profileId?.toString(),
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
              score: totalScore,
              clsScore,
              fcpScore,
              lcpScore,
              ttfbScore,
              fidScore,
            };
          })
      : [];

  return {
    data: tableData,
    isLoading,
    ...rest,
  };
};
