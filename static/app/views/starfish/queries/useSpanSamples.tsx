import moment from 'moment';
import * as qs from 'query-string';

import {useQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanIndexedFields, SpanIndexedFieldTypes} from 'sentry/views/starfish/types';
import {getDateConditions} from 'sentry/views/starfish/utils/getDateConditions';
import {DATE_FORMAT} from 'sentry/views/starfish/utils/useSpansQuery';

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
    enabled: Boolean(groupId && transactionName),
    initialData: [],
  });
};
