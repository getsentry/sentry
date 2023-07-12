import moment from 'moment';
import * as qs from 'query-string';

import {useQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {computeAxisMax} from 'sentry/views/starfish/components/chart';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {
  SpanIndexedFields,
  SpanIndexedFieldTypes,
  SpanMetricsFields,
} from 'sentry/views/starfish/types';
import {getDateConditions} from 'sentry/views/starfish/utils/getDateConditions';
import {DATE_FORMAT} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_SELF_TIME} = SpanMetricsFields;

type Options = {
  groupId?: string;
  transactionMethod?: string;
  transactionName?: string;
};

export type SpanSample = Pick<
  SpanIndexedFieldTypes,
  | SpanIndexedFields.SPAN_SELF_TIME
  | SpanIndexedFields.TRANSACTION_ID
  | SpanIndexedFields.PROJECT
  | SpanIndexedFields.TIMESTAMP
  | SpanIndexedFields.ID
>;

export const useSpanSamples = (options: Options) => {
  const url = '/api/0/organizations/sentry/spans-samples/';
  const api = useApi();
  const pageFilter = usePageFilters();
  const {groupId, transactionName, transactionMethod} = options;
  const location = useLocation();

  const query = new MutableSearch([
    `span.group:${groupId}`,
    `transaction:${transactionName}`,
    `transaction.method:${transactionMethod}`,
  ]);

  const dateCondtions = getDateConditions(pageFilter.selection);

  const {isLoading: isLoadingSeries, data: spanMetricsSeriesData} = useSpanMetricsSeries(
    groupId ? {group: groupId} : undefined,
    {transactionName, 'transaction.method': transactionMethod},
    [`p95(${SPAN_SELF_TIME})`],
    'starfish.sidebar-span-metrics'
  );

  const maxYValue = computeAxisMax([spanMetricsSeriesData?.[`p95(${SPAN_SELF_TIME})`]]);

  return useQuery<SpanSample[]>({
    queryKey: [
      'span-samples',
      groupId,
      transactionName,
      dateCondtions.statsPeriod,
      dateCondtions.start,
      dateCondtions.end,
    ],
    queryFn: async () => {
      const {data} = await api.requestPromise(
        `${url}?${qs.stringify({
          ...dateCondtions,
          ...{utc: location.query.utc},
          lowerBound: 0,
          firstBound: maxYValue * (1 / 3),
          secondBound: maxYValue * (2 / 3),
          upperBound: maxYValue,
          query: query.formatString(),
        })}`
      );
      return data
        ?.map((d: SpanSample) => ({
          ...d,
          timestamp: moment(d.timestamp).format(DATE_FORMAT),
        }))
        .sort(
          (a: SpanSample, b: SpanSample) => b['span.self_time'] - a['span.self_time']
        );
    },
    refetchOnWindowFocus: false,
    enabled: Boolean(groupId && transactionName && !isLoadingSeries),
    initialData: [],
  });
};
