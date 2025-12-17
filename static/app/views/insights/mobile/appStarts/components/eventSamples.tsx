import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {COLD_START_TYPE} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import {EventSamplesTable} from 'sentry/views/insights/mobile/screenload/components/tables/eventSamplesTable';
import {SpanFields} from 'sentry/views/insights/types';

const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'span.duration',
};

type Props = {
  cursorName: string;
  sortKey: string;
  transaction: string;
  footerAlignedPagination?: boolean;
  release?: string;
};

export function EventSamples({
  cursorName,
  transaction,
  release,
  sortKey,
  footerAlignedPagination,
}: Props) {
  const location = useLocation();
  const {selection} = usePageFilters();
  const cursor = decodeScalar(location.query?.[cursorName]);

  const deviceClass = decodeScalar(location.query[SpanFields.DEVICE_CLASS]) ?? '';
  const startType =
    decodeScalar(location.query[SpanFields.APP_START_TYPE]) ?? COLD_START_TYPE;

  const searchQuery = new MutableSearch([
    `transaction:${transaction}`,
    ...(release ? [`release:${release}`] : []),
    ...(startType ? [`${SpanFields.APP_START_TYPE}:${startType}`] : []),
    ...(deviceClass ? [`${SpanFields.DEVICE_CLASS}:${deviceClass}`] : []),
  ]);

  // TODO: Add this back in once os.name is available in the spansIndexed dataset
  // const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();
  // if (isProjectCrossPlatform) {
  //   searchQuery.addFilterValue('os.name', selectedPlatform);
  // }

  const sort = decodeSorts(location.query[sortKey])[0] ?? DEFAULT_SORT;

  const columnNameMap = {
    'transaction.span_id': t('Event ID'),
    profile_id: t('Profile'),
    'span.duration': t('Duration'),
  };

  const newQuery: NewQuery = {
    name: '',
    fields: [
      'trace',
      'timestamp',
      'transaction.span_id',
      'project.name',
      'profile_id',
      'span.duration',
    ],
    query: searchQuery.formatString(),
    dataset: DiscoverDatasets.SPANS,
    version: 2,
    projects: selection.projects,
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  eventView.sorts = [sort];

  const {data, meta, isPending, pageLinks} = useSpans(
    {
      search: searchQuery.formatString(),
      cursor,
      limit: 10,
      enabled: true,
      fields: [
        SpanFields.ID,
        SpanFields.TRACE,
        SpanFields.TIMESTAMP,
        SpanFields.TRANSACTION,
        SpanFields.TRANSACTION_SPAN_ID,
        SpanFields.PROJECT,
        SpanFields.PROFILE_ID,
        SpanFields.SPAN_DURATION,
      ],
    },
    'api.insights.mobile-startup-event-samples'
  );

  return (
    <EventSamplesTable
      cursorName={cursorName}
      eventIdKey={SpanFields.TRANSACTION_SPAN_ID}
      eventView={eventView}
      isLoading={isPending}
      profileIdKey="profile_id"
      sortKey={sortKey}
      data={{data, meta}}
      pageLinks={pageLinks}
      columnNameMap={columnNameMap}
      sort={sort}
      footerAlignedPagination={footerAlignedPagination}
    />
  );
}
