import moment from 'moment';
import * as qs from 'query-string';

import {useQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {computeAxisMax} from 'sentry/views/starfish/components/chart';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {SpanIndexedField, SpanIndexedFieldTypes} from 'sentry/views/starfish/types';
import {getDateConditions} from 'sentry/views/starfish/utils/getDateConditions';
import {DATE_FORMAT} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_SELF_TIME, SPAN_GROUP} = SpanIndexedField;

type Options = {
  groupId: string;
  transactionName: string;
  transactionMethod?: string;
};

export type SpanSample = Pick<
  SpanIndexedFieldTypes,
  | SpanIndexedField.SPAN_SELF_TIME
  | SpanIndexedField.TRANSACTION_ID
  | SpanIndexedField.PROJECT
  | SpanIndexedField.TIMESTAMP
  | SpanIndexedField.ID
>;

export const useSpanSamples = (options: Options) => {
  const organization = useOrganization();
  const url = `/api/0/organizations/${organization.slug}/spans-samples/`;
  const api = useApi();
  const pageFilter = usePageFilters();
  const {groupId, transactionName, transactionMethod} = options;
  const location = useLocation();

  const query = new MutableSearch([
    `${SPAN_GROUP}:${groupId}`,
    `transaction:"${transactionName}"`,
  ]);

  if (transactionMethod) {
    query.addFilterValue('transaction.method', transactionMethod);
  }

  const filters = {
    transactionName,
  };

  if (transactionMethod) {
    filters['transaction.method'] = transactionMethod;
  }

  const dateCondtions = getDateConditions(pageFilter.selection);

  const {isLoading: isLoadingSeries, data: spanMetricsSeriesData} = useSpanMetricsSeries(
    groupId,
    filters,
    [`avg(${SPAN_SELF_TIME})`],
    'api.starfish.sidebar-span-metrics'
  );

  const maxYValue = computeAxisMax([spanMetricsSeriesData?.[`avg(${SPAN_SELF_TIME})`]]);

  const enabled = Boolean(
    groupId && transactionName && !isLoadingSeries && pageFilter.isReady
  );

  const result = useQuery<SpanSample[]>({
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
          project: pageFilter.selection.projects,
          query: query.formatString(),
        })}`
      );
      return data
        ?.map((d: SpanSample) => ({
          ...d,
          timestamp: moment(d.timestamp).format(DATE_FORMAT),
        }))
        .sort((a: SpanSample, b: SpanSample) => b[SPAN_SELF_TIME] - a[SPAN_SELF_TIME]);
    },
    refetchOnWindowFocus: false,
    enabled,
    initialData: [],
  });

  return {...result, isEnabled: enabled};
};
