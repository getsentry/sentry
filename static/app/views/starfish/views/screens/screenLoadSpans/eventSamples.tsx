import {t} from 'sentry/locale';
import {NewQuery} from 'sentry/types';
import EventView, {fromSorts} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {EventSamplesTable} from 'sentry/views/starfish/views/screens/screenLoadSpans/eventSamplesTable';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

const DEFAULT_SORT = {
  kind: 'desc',
  field: 'measurements.time_to_initial_display',
};

type Props = {
  cursorName: string;
  release: string;
  sortKey: string;
  transaction: string;
  showDeviceClassSelector?: boolean;
};

export function ScreenLoadEventSamples({
  cursorName,
  transaction,
  release,
  sortKey,
  showDeviceClassSelector,
}: Props) {
  const location = useLocation();
  const {selection} = usePageFilters();
  const cursor = decodeScalar(location.query?.[cursorName]);

  const searchQuery = new MutableSearch([
    'transaction.op:ui.load',
    `transaction:${transaction}`,
    `release:${release}`,
  ]);

  const deviceClass = decodeScalar(location.query['device.class']);

  if (deviceClass) {
    if (deviceClass === 'Unknown') {
      searchQuery.addFilterValue('!has', 'device.class');
    } else {
      searchQuery.addFilterValue('device.class', deviceClass);
    }
  }

  const sort = fromSorts(decodeScalar(location.query[sortKey]))[0] ?? DEFAULT_SORT;

  const columnNameMap = {
    id: t('Event ID (%s)', formatVersionAndCenterTruncate(release)),
    'profile.id': t('Profile'),
    'measurements.time_to_initial_display': t('TTID'),
    'measurements.time_to_full_display': t('TTFD'),
  };

  const newQuery: NewQuery = {
    name: '',
    fields: [
      'id',
      'project.name',
      'profile.id',
      'measurements.time_to_initial_display',
      'measurements.time_to_full_display',
    ],
    query: searchQuery.formatString(),
    dataset: DiscoverDatasets.DISCOVER,
    version: 2,
    projects: selection.projects,
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  eventView.sorts = [sort];

  const {data, isLoading, pageLinks} = useTableQuery({
    eventView,
    enabled: true,
    limit: 4,
    cursor,
    referrer: 'api.starfish.mobile-event-samples',
  });

  return (
    <EventSamplesTable
      eventIdKey="id"
      profileIdKey="profile.id"
      isLoading={isLoading}
      cursorName={cursorName}
      pageLinks={pageLinks}
      eventView={eventView}
      sortKey={sortKey}
      data={data}
      showDeviceClassSelector={showDeviceClassSelector}
      columnNameMap={columnNameMap}
      sort={sort}
    />
  );
}
