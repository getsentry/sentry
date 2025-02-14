import moment from 'moment-timezone';
import * as qs from 'query-string';

import {useQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {computeAxisMax} from 'sentry/views/insights/common/components/chart';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {DATE_FORMAT} from 'sentry/views/insights/common/queries/useSpansQuery';
import {getDateConditions} from 'sentry/views/insights/common/utils/getDateConditions';
import type {
  SpanIndexedFieldTypes,
  SpanMetricsQueryFilters,
  SubregionCode,
} from 'sentry/views/insights/types';
import {SpanIndexedField, SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME, SPAN_GROUP} = SpanIndexedField;

type Options = {
  groupId: string;
  transactionName: string;
  additionalFields?: string[];
  release?: string;
  spanSearch?: MutableSearch;
  subregions?: SubregionCode[];
  transactionMethod?: string;
};

export type SpanSample = Pick<
  SpanIndexedFieldTypes,
  | SpanIndexedField.SPAN_SELF_TIME
  | SpanIndexedField.TRANSACTION_ID
  | SpanIndexedField.PROJECT
  | SpanIndexedField.TIMESTAMP
  | SpanIndexedField.SPAN_ID
  | SpanIndexedField.PROFILE_ID
  | SpanIndexedField.HTTP_RESPONSE_CONTENT_LENGTH
  | SpanIndexedField.TRACE
>;

export const useSpanSamples = (options: Options) => {
  const organization = useOrganization();
  const url = `/api/0/organizations/${organization.slug}/spans-samples/`;
  const api = useApi();
  const pageFilter = usePageFilters();
  const {
    groupId,
    transactionName,
    transactionMethod,
    release,
    spanSearch,
    additionalFields,
    subregions,
  } = options;
  const location = useLocation();

  const query = spanSearch !== undefined ? spanSearch.copy() : new MutableSearch([]);
  query.addFilterValue(SPAN_GROUP, groupId);
  query.addFilterValue('transaction', transactionName);

  const filters: SpanMetricsQueryFilters = {
    transaction: transactionName,
  };

  if (transactionMethod) {
    query.addFilterValue('transaction.method', transactionMethod);
    filters['transaction.method'] = transactionMethod;
  }

  if (release) {
    query.addFilterValue('release', release);
    filters.release = release;
  }

  if (subregions) {
    query.addDisjunctionFilterValues(SpanMetricsField.USER_GEO_SUBREGION, subregions);
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    filters[SpanMetricsField.USER_GEO_SUBREGION] = `[${subregions.join(',')}]`;
  }

  const dateCondtions = getDateConditions(pageFilter.selection);

  const {isPending: isLoadingSeries, data: spanMetricsSeriesData} = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject({'span.group': groupId, ...filters}),
      yAxis: [`avg(${SPAN_SELF_TIME})`],
      enabled: Object.values({'span.group': groupId, ...filters}).every(value =>
        Boolean(value)
      ),
    },
    'api.starfish.sidebar-span-metrics'
  );

  const maxYValue = computeAxisMax([spanMetricsSeriesData?.[`avg(${SPAN_SELF_TIME})`]]);

  const enabled = Boolean(
    groupId && transactionName && !isLoadingSeries && pageFilter.isReady
  );

  const queryString = query.formatString();

  const result = useQuery<SpanSample[]>({
    queryKey: [
      'span-samples',
      groupId,
      transactionName,
      dateCondtions.statsPeriod,
      dateCondtions.start,
      dateCondtions.end,
      queryString,
      subregions?.join(','),
      additionalFields?.join(','),
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
          query: queryString,
          ...(additionalFields?.length ? {additionalFields} : {}),
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
