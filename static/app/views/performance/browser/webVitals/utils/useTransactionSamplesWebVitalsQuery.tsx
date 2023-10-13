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
  limit?: number;
  orderBy?: WebVitals | null;
  query?: string;
};

export const useTransactionSamplesWebVitalsQuery = ({
  orderBy,
  limit,
  transaction,
  query,
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
      enabled: pageFilters.isReady,
      refetchOnWindowFocus: false,
    },
  });

  const toInt = (item: ReactText) => (item ? parseInt(item.toString(), 10) : null);
  const tableData: TransactionSampleRowWithScore[] =
    !isLoading && data?.data.length
      ? data.data
          .map(row => ({
            id: row.id?.toString(),
            'user.display': row['user.display']?.toString(),
            transaction: row.transaction?.toString(),
            'transaction.op': row['transaction.op']?.toString(),
            'measurements.lcp': toInt(row['measurements.lcp']),
            'measurements.fcp': toInt(row['measurements.fcp']),
            'measurements.cls': toInt(row['measurements.cls']),
            'measurements.ttfb': toInt(row['measurements.ttfb']),
            'measurements.fid': toInt(row['measurements.fid']),
            'transaction.duration': toInt(row['transaction.duration']),
            replayId: row.replayId?.toString(),
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
