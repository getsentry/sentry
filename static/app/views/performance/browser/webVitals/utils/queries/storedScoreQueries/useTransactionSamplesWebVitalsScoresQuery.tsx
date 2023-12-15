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
  SORTABLE_INDEXED_SCORE_FIELDS,
  TransactionSampleRowWithScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';

type Props = {
  transaction: string;
  enabled?: boolean;
  limit?: number;
  orderBy?: WebVitals | null;
  query?: string;
  sortName?: string;
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
}: Props) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();
  const shouldUseStoredScores = useStoredScoresSetting();

  const filteredSortableFields = shouldUseStoredScores
    ? SORTABLE_INDEXED_FIELDS
    : SORTABLE_INDEXED_FIELDS.filter(
        field => !SORTABLE_INDEXED_SCORE_FIELDS.includes(field)
      );

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
        ...(webVital
          ? [`measurements.score.${webVital}`, `measurements.score.weight.${webVital}`]
          : []),
      ],
      name: 'Web Vitals',
      query: [
        'transaction.op:pageload',
        `transaction:"${transaction}"`,
        'has:measurements.score.total',
        ...(query ? [query] : []),
      ].join(' '),
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
      ? (data.data.map(
          row => ({
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
            totalScore: Math.round(
              (toNumber(row['measurements.score.total']) ?? 0) * 100
            ),
            ...(webVital
              ? {
                  [`${webVital}Score`]: Math.round(
                    ((toNumber(row[`measurements.score.${webVital}`]) ?? 0) /
                      (toNumber(row[`measurements.score.weight.${webVital}`]) ?? 0)) *
                      100
                  ),
                  [`${webVital}Weight`]: Math.round(
                    (toNumber(row[`measurements.score.weight.${webVital}`]) ?? 0) * 100
                  ),
                }
              : {}),
          })
          // TODO: Discover doesn't let us query more than 20 fields and we're hitting that limit.
          // Clean up the types to account for this so we don't need to do this casting.
        ) as TransactionSampleRowWithScore[])
      : [];

  return {
    data: tableData,
    isLoading,
    ...rest,
  };
};
