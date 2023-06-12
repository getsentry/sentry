import keyBy from 'lodash/keyBy';

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useQueryGetSpanSamples,
  useQuerySpansInTransaction,
} from 'sentry/views/starfish/views/spanSummaryPage/queries';

type SampleListDatRow = {
  exclusive_time: number;
  p95Comparison: number;
  'project.name': string;
  spanDuration: number;
  spanOp: string;
  span_id: string;
  timestamp: string;
  transaction: string;
  transactionDuration: number;
  transaction_id: string;
  user: string;
};

export const useQueryGetSpanTransactionSamples = ({
  groupId,
  transactionName,
}: {
  groupId: string;
  transactionName: string;
}) => {
  const {
    data,
    isLoading: isTransactionDataLoading,
    isRefetching: isTransactionDataRefetching,
  } = useQuerySpansInTransaction({
    groupId,
  });
  const p50 = data[0]?.p50 ?? 0;

  const spanSampleResult = useQueryGetSpanSamples({groupId, transactionName, p50});
  const {data: combinedSpanSampleData} = spanSampleResult.reduce(
    (acc: {data: any[]; isLoading: boolean; spanIds: Set<string>}, result) => {
      if (result.isLoading) {
        acc.isLoading = true;
        return acc;
      }

      // Ensures that the same span is not added twice, since there could be overlap in the case of sparse data
      result.data.forEach(datum => {
        if (!acc.spanIds.has(datum.span_id)) {
          acc.spanIds.add(datum.span_id);
          acc.data.push(datum);
        }
      });

      return acc;
    },
    {isLoading: false, data: [], spanIds: new Set<string>()}
  );

  const transactionDataResult = useQueryTransactionData(combinedSpanSampleData);
  const transactionDataById = keyBy(transactionDataResult?.data?.data, 'id');

  const newData: SampleListDatRow[] = combinedSpanSampleData.map(datum => {
    const transaction = transactionDataById[
      datum.transaction_id.replaceAll('-', '')
    ] as any;

    return {
      transaction: datum.transaction,
      transaction_id: datum.transaction_id,
      'project.name': transaction?.['project.name'],
      span_id: datum.span_id,
      timestamp: transaction?.timestamp,
      spanOp: datum.span_operation,
      spanDuration: datum.exclusive_time,
      transactionDuration: transaction?.['transaction.duration'],
      exclusive_time: datum.exclusive_time,
      p95Comparison: datum.p95_comparison,
      user: datum.user,
    };
  });

  const isLoading =
    isTransactionDataLoading ||
    spanSampleResult.reduce<boolean>((acc, result) => acc || result.isLoading, false);

  const isRefetching =
    isTransactionDataRefetching ||
    spanSampleResult.reduce<boolean>((acc, result) => acc || result.isRefetching, false);

  return {data: newData, isLoading, isRefetching};
};

const useQueryTransactionData = (data: {transaction_id: string}[]) => {
  const location = useLocation();
  const {slug} = useOrganization();
  const eventView = EventView.fromNewQueryWithLocation(
    {
      fields: ['id', 'timestamp', 'project.name', 'transaction.duration'],
      name: 'Starfish - Sample List - transaction data',
      projects: [1],
      version: 2,
      query: `id:[${data.map(d => d.transaction_id.replaceAll('-', '')).join(',')}]`,
    },
    location
  );

  return useDiscoverQuery({eventView, location, orgSlug: slug});
};
