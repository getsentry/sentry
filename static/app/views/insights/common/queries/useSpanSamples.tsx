import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {computeAxisMax} from 'sentry/views/insights/common/components/chart';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getDateConditions} from 'sentry/views/insights/common/utils/getDateConditions';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import type {
  SpanIndexedFieldTypes,
  SpanIndexedProperty,
  SpanIndexedResponse,
  SpanMetricsQueryFilters,
  SubregionCode,
} from 'sentry/views/insights/types';
import {SpanIndexedField, SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME, SPAN_GROUP} = SpanIndexedField;

type Options<Fields extends NonDefaultSpanSampleFields[]> = {
  groupId: string;
  transactionName: string;
  additionalFields?: Fields;
  referrer?: string;
  release?: string;
  spanSearch?: MutableSearch;
  subregions?: SubregionCode[];
  transactionMethod?: string;
};

export type SpanSample = Pick<
  SpanIndexedFieldTypes,
  | SpanIndexedField.SPAN_SELF_TIME
  | SpanIndexedField.TRANSACTION_SPAN_ID
  | SpanIndexedField.PROJECT
  | SpanIndexedField.TIMESTAMP
  | SpanIndexedField.SPAN_ID
  | SpanIndexedField.PROFILEID
  | SpanIndexedField.HTTP_RESPONSE_CONTENT_LENGTH
  | SpanIndexedField.TRACE
>;

export type DefaultSpanSampleFields =
  | SpanIndexedField.PROJECT
  | SpanIndexedField.TRANSACTION_SPAN_ID
  | SpanIndexedField.TIMESTAMP
  | SpanIndexedField.SPAN_ID
  | SpanIndexedField.PROFILEID
  | SpanIndexedField.SPAN_SELF_TIME;

export type NonDefaultSpanSampleFields = Exclude<
  SpanIndexedProperty,
  DefaultSpanSampleFields
>;

export const useSpanSamples = <Fields extends NonDefaultSpanSampleFields[]>(
  options: Options<Fields>
) => {
  const organization = useOrganization();
  const pageFilter = usePageFilters();
  const {
    groupId,
    transactionName,
    transactionMethod,
    release,
    spanSearch,
    subregions,
    additionalFields = [],
  } = options;
  const location = useLocation();
  const useEap = useInsightsEap();

  const query = spanSearch === undefined ? new MutableSearch([]) : spanSearch.copy();
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

  const dateConditions = getDateConditions(pageFilter.selection);

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

  const min = 0;
  const max = computeAxisMax([spanMetricsSeriesData?.[`avg(${SPAN_SELF_TIME})`]]);

  const enabled = Boolean(
    groupId && transactionName && !isLoadingSeries && pageFilter.isReady
  );

  type DataRow = Pick<
    SpanIndexedResponse,
    Fields[number] | DefaultSpanSampleFields // These fields are returned by default
  >;

  return useApiQuery<{
    data: DataRow[];
    meta: EventsMetaType;
  }>(
    [
      `/api/0/organizations/${organization.slug}/spans-samples/`,
      {
        query: {
          query: query.formatString(),
          project: pageFilter.selection.projects,
          ...dateConditions,
          ...{utc: location.query.utc},
          environment: pageFilter.selection.environments,
          lowerBound: min,
          firstBound: max * (1 / 3),
          secondBound: max * (2 / 3),
          upperBound: max,
          additionalFields: [
            SpanIndexedField.ID,
            SpanIndexedField.TRANSACTION_SPAN_ID, // TODO: transaction.span_id should be a default from the backend
            ...additionalFields,
          ],
          sampling: useEap ? SAMPLING_MODE.NORMAL : undefined,
          dataset: useEap ? DiscoverDatasets.SPANS_EAP : undefined,
          sort: `-${SPAN_SELF_TIME}`,
        },
      },
    ],
    {
      enabled,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    }
  );
};
