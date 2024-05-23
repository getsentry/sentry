import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {calculatePerformanceScoreFromTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import type {RowWithScore} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useAggregateFunction} from 'sentry/views/performance/browser/webVitals/utils/useAggregateFunction';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';

type Props = {
  defaultSort?: Sort;
  enabled?: boolean;
  limit?: number;
  query?: string;
  sortName?: string;
  transaction?: string | null;
};

export const useTransactionRawWebVitalsQuery = ({
  limit,
  transaction,
  defaultSort,
  sortName = 'sort',
  enabled = true,
  query,
}: Props) => {
  const aggregateFunction = useAggregateFunction();
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const sort = useWebVitalsSort({sortName, defaultSort});

  const search = new MutableSearch([
    'transaction.op:pageload',
    ...(query ? [query] : []),
  ]);
  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'transaction',
        'transaction.op',
        `${aggregateFunction}(measurements.lcp)`,
        `${aggregateFunction}(measurements.fcp)`,
        `${aggregateFunction}(measurements.cls)`,
        `${aggregateFunction}(measurements.ttfb)`,
        `${aggregateFunction}(measurements.fid)`,
        'count_web_vitals(measurements.lcp, any)',
        'count_web_vitals(measurements.fcp, any)',
        'count_web_vitals(measurements.cls, any)',
        'count_web_vitals(measurements.ttfb, any)',
        'count_web_vitals(measurements.fid, any)',
        'count()',
      ],
      name: 'Web Vitals',
      query: search.formatString(),
      version: 2,
      dataset: DiscoverDatasets.METRICS,
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
    referrer: 'api.performance.browser.web-vitals.transactions',
  });

  const tableData: RowWithScore[] =
    !isLoading && data?.data.length
      ? data.data
          .map(row => ({
            transaction: row.transaction?.toString(),
            'transaction.op': row['transaction.op']?.toString(),
            [`${aggregateFunction}(measurements.lcp)`]: row[
              `${aggregateFunction}(measurements.lcp)`
            ] as number,
            [`${aggregateFunction}(measurements.fcp)`]: row[
              `${aggregateFunction}(measurements.fcp)`
            ] as number,
            [`${aggregateFunction}(measurements.cls)`]: row[
              `${aggregateFunction}(measurements.cls)`
            ] as number,
            [`${aggregateFunction}(measurements.ttfb)`]: row[
              `${aggregateFunction}(measurements.ttfb)`
            ] as number,
            [`${aggregateFunction}(measurements.fid)`]: row[
              `${aggregateFunction}(measurements.fid)`
            ] as number,
            [`${aggregateFunction}(measurements.inp)`]: row[
              `${aggregateFunction}(measurements.fid)`
            ] as number,
            'count()': row['count()'] as number,
            'count_web_vitals(measurements.lcp, any)': row[
              'count_web_vitals(measurements.lcp, any)'
            ] as number,
            'count_web_vitals(measurements.fcp, any)': row[
              'count_web_vitals(measurements.fcp, any)'
            ] as number,
            'count_web_vitals(measurements.cls, any)': row[
              'count_web_vitals(measurements.cls, any)'
            ] as number,
            'count_web_vitals(measurements.ttfb, any)': row[
              'count_web_vitals(measurements.ttfb, any)'
            ] as number,
            'count_web_vitals(measurements.fid, any)': row[
              'count_web_vitals(measurements.fid, any)'
            ] as number,
          }))
          .map(row => {
            const {totalScore, clsScore, fcpScore, lcpScore, ttfbScore, fidScore} =
              calculatePerformanceScoreFromTableDataRow({
                data: {id: '', ...row},
                aggregateFunction,
              }); // dummy id to satisfy type
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
