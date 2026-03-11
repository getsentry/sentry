import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {computeAxisMax} from 'sentry/views/insights/common/components/chart';
import {getDateConditions} from 'sentry/views/insights/common/utils/getDateConditions';
import type {
  SpanProperty,
  SpanQueryFilters,
  SpanResponse,
  SubregionCode,
} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME, SPAN_GROUP} = SpanFields;

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
  SpanResponse,
  | SpanFields.SPAN_SELF_TIME
  | SpanFields.TRANSACTION_SPAN_ID
  | SpanFields.PROJECT
  | SpanFields.TIMESTAMP
  | SpanFields.SPAN_ID
  | SpanFields.PROFILEID
  | SpanFields.HTTP_RESPONSE_CONTENT_LENGTH
  | SpanFields.TRACE
>;

export type DefaultSpanSampleFields =
  | SpanFields.PROJECT
  | SpanFields.TRANSACTION_SPAN_ID
  | SpanFields.TIMESTAMP
  | SpanFields.SPAN_ID
  | SpanFields.PROFILEID
  | SpanFields.SPAN_SELF_TIME;

export type NonDefaultSpanSampleFields = Exclude<SpanProperty, DefaultSpanSampleFields>;

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

  const query = spanSearch === undefined ? new MutableSearch([]) : spanSearch.copy();
  query.addFilterValue(SPAN_GROUP, groupId);
  query.addFilterValue('transaction', transactionName);

  const filters: SpanQueryFilters = {
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
    query.addDisjunctionFilterValues(SpanFields.USER_GEO_SUBREGION, subregions);
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    filters[SpanFields.USER_GEO_SUBREGION] = `[${subregions.join(',')}]`;
  }

  const dateConditions = getDateConditions(pageFilter.selection);

  const {isPending: isLoadingSeries, data: spanMetricsSeriesData} =
    useFetchSpanTimeSeries(
      {
        query: MutableSearch.fromQueryObject({'span.group': groupId, ...filters}),
        yAxis: [`avg(${SPAN_SELF_TIME})`],
        enabled: Object.values({'span.group': groupId, ...filters}).every(value =>
          Boolean(value)
        ),
      },
      'api.insights.sidebar-span-metrics'
    );

  const timeSeries = spanMetricsSeriesData?.timeSeries || [];
  const avgSelfTimeSeries = timeSeries.find(ts => ts.yAxis === `avg(${SPAN_SELF_TIME})`);

  const min = 0;
  const max = computeAxisMax([
    avgSelfTimeSeries
      ? {
          data: avgSelfTimeSeries.values.map(v => ({
            name: v.timestamp,
            value: v.value || 0,
          })),
          seriesName: avgSelfTimeSeries.yAxis,
        }
      : {data: [], seriesName: `avg(${SPAN_SELF_TIME})`},
  ]);

  const enabled = Boolean(
    groupId && transactionName && !isLoadingSeries && pageFilter.isReady
  );

  type DataRow = Pick<
    SpanResponse,
    Fields[number] | DefaultSpanSampleFields // These fields are returned by default
  >;

  return useApiQuery<{
    data: DataRow[];
    meta: EventsMetaType;
  }>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/spans-samples/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
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
            SpanFields.ID,
            SpanFields.TRANSACTION_SPAN_ID, // TODO: transaction.span_id should be a default from the backend
            ...additionalFields,
          ],
          sampling: SAMPLING_MODE.NORMAL,
          dataset: DiscoverDatasets.SPANS,
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
