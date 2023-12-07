import {ReactText} from 'react';

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {mapWebVitalToOrderBy} from 'sentry/views/performance/browser/webVitals/utils/mapWebVitalToOrderBy';
import {
  DEFAULT_INDEXED_SORT,
  SORTABLE_INDEXED_FIELDS,
  TransactionSampleRowWithScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';

type Props = {
  transaction: string;
  enabled?: boolean;
  limit?: number;
  orderBy?: WebVitals | null;
  query?: string;
  withProfiles?: boolean;
};

export const useTransactionSamplesWebVitalsScoresQuery = ({
  orderBy,
  limit,
  transaction,
  query,
  enabled,
  withProfiles,
}: Props) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const sort = useWebVitalsSort({
    defaultSort: DEFAULT_INDEXED_SORT,
    sortableFields: SORTABLE_INDEXED_FIELDS as unknown as string[],
  });

  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'id',
        'user.display',
        'transaction',
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
        'measurements.score.total',
        'measurements.score.lcp',
        'measurements.score.fcp',
        'measurements.score.cls',
        'measurements.score.ttfb',
        'measurements.score.fid',
      ],
      name: 'Web Vitals',
      query: `transaction.op:pageload transaction:"${transaction}" has:measurements.score.total ${
        query ? query : ''
      }`,
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

  const toNumber = (item: ReactText) => (item ? parseFloat(item.toString()) : null);
  const tableData: TransactionSampleRowWithScore[] =
    !isLoading && data?.data.length
      ? data.data.map(row => ({
          id: row.id?.toString(),
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
          score: Math.round((toNumber(row['measurements.score.total']) ?? 0) * 100),
          clsScore: Math.round((toNumber(row['measurements.score.cls']) ?? 0) * 100),
          fcpScore: Math.round((toNumber(row['measurements.score.fcp']) ?? 0) * 100),
          lcpScore: Math.round((toNumber(row['measurements.score.lcp']) ?? 0) * 100),
          ttfbScore: Math.round((toNumber(row['measurements.score.ttfb']) ?? 0) * 100),
          fidScore: Math.round((toNumber(row['measurements.score.fid']) ?? 0) * 100),
        }))
      : [];

  return {
    data: tableData,
    isLoading,
    ...rest,
  };
};
