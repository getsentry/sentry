import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  PRIMARY_RELEASE_ALIAS,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/insights/common/components/releaseSelector';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {COLD_START_TYPE} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import {EventSamplesTable} from 'sentry/views/insights/mobile/screenload/components/tables/eventSamplesTable';
import {SpanIndexedField, SpanMetricsField} from 'sentry/views/insights/types';

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
  showDeviceClassSelector?: boolean;
};

export function EventSamples({
  cursorName,
  transaction,
  release,
  sortKey,
  showDeviceClassSelector,
  footerAlignedPagination,
}: Props) {
  const location = useLocation();
  const {selection} = usePageFilters();
  const {primaryRelease} = useReleaseSelection();
  const cursor = decodeScalar(location.query?.[cursorName]);

  const deviceClass = decodeScalar(location.query[SpanMetricsField.DEVICE_CLASS]) ?? '';
  const startType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;

  const searchQuery = new MutableSearch([
    `transaction:${transaction}`,
    `release:${release}`,
    ...(startType ? [`${SpanMetricsField.APP_START_TYPE}:${startType}`] : []),
    ...(deviceClass ? [`${SpanMetricsField.DEVICE_CLASS}:${deviceClass}`] : []),
  ]);

  // TODO: Add this back in once os.name is available in the spansIndexed dataset
  // const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();
  // if (isProjectCrossPlatform) {
  //   searchQuery.addFilterValue('os.name', selectedPlatform);
  // }

  const sort = decodeSorts(location.query[sortKey])[0] ?? DEFAULT_SORT;

  const columnNameMap = {
    'transaction.span_id': t(
      'Event ID (%s)',
      release === primaryRelease ? PRIMARY_RELEASE_ALIAS : SECONDARY_RELEASE_ALIAS
    ),
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
    dataset: DiscoverDatasets.SPANS_INDEXED,
    version: 2,
    projects: selection.projects,
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  eventView.sorts = [sort];

  const {data, meta, isPending, pageLinks} = useSpansIndexed(
    {
      search: searchQuery.formatString(),
      cursor,
      limit: 4,
      enabled: defined(release),
      fields: [
        SpanIndexedField.TRACE,
        SpanIndexedField.TIMESTAMP,
        SpanIndexedField.TRANSACTION,
        SpanIndexedField.TRANSACTION_SPAN_ID,
        SpanIndexedField.PROJECT,
        SpanIndexedField.PROFILE_ID,
        SpanIndexedField.SPAN_DURATION,
      ],
    },
    'api.starfish.mobile-startup-event-samples'
  );

  return (
    <EventSamplesTable
      cursorName={cursorName}
      eventIdKey={SpanIndexedField.TRANSACTION_SPAN_ID}
      eventView={eventView}
      isLoading={defined(release) && isPending}
      profileIdKey="profile_id"
      sortKey={sortKey}
      data={{data, meta}}
      pageLinks={pageLinks}
      showDeviceClassSelector={showDeviceClassSelector}
      columnNameMap={columnNameMap}
      sort={sort}
      footerAlignedPagination={footerAlignedPagination}
    />
  );
}
