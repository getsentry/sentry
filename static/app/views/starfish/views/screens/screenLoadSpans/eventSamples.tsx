import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {Tooltip} from 'sentry/components/tooltip';
import {IconProfiling} from 'sentry/icons/iconProfiling';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import {defined} from 'sentry/utils';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView, {
  fromSorts,
  isFieldSortable,
  MetaType,
} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment, Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {TableColumn} from 'sentry/views/discover/table/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {DeviceClassSelector} from 'sentry/views/starfish/views/screens/screenLoadSpans/deviceClassSelector';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

type Props = {
  cursorName: string;
  release: string;
  sortKey: string;
  transaction: string;
  showDeviceClassSelector?: boolean;
};

const ICON_FIELDS = ['profile.id'];

export function ScreenLoadEventSamples({
  cursorName,
  transaction,
  release,
  sortKey,
  showDeviceClassSelector,
}: Props) {
  const location = useLocation();
  const {selection} = usePageFilters();
  const organization = useOrganization();
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

  const sort = fromSorts(decodeScalar(location.query[sortKey]))[0] ?? {
    kind: 'desc',
    field: 'measurements.time_to_initial_display',
  };

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

  const eventViewColumns = eventView.getColumns();

  function renderBodyCell(column, row): React.ReactNode {
    if (!data?.meta || !data?.meta.fields) {
      return row[column.key];
    }

    if (column.key === 'id') {
      return (
        <Link
          to={normalizeUrl(
            `/organizations/${organization.slug}/performance/${row['project.name']}:${row.id}`
          )}
        >
          {row.id.slice(0, 8)}
        </Link>
      );
    }

    if (column.key === 'profile.id') {
      const profileTarget =
        defined(row['project.name']) && defined(row['profile.id'])
          ? generateProfileFlamechartRoute({
              orgSlug: organization.slug,
              projectSlug: row['project.name'],
              profileId: String(row['profile.id']),
            })
          : null;
      return (
        <IconWrapper>
          {profileTarget && (
            <Tooltip title={t('View Profile')}>
              <LinkButton to={profileTarget} size="xs">
                <IconProfiling size="xs" />
              </LinkButton>
            </Tooltip>
          )}
        </IconWrapper>
      );
    }

    const renderer = getFieldRenderer(column.key, data?.meta.fields, false);
    const rendered = renderer(row, {
      location,
      organization,
      unit: data?.meta.units?.[column.key],
    });
    return rendered;
  }

  function renderHeadCell(
    column: GridColumnHeader,
    tableMeta?: MetaType
  ): React.ReactNode {
    const fieldType = tableMeta?.fields?.[column.key];
    let alignment = fieldAlignment(column.key as string, fieldType);
    if (ICON_FIELDS.includes(column.key as string)) {
      alignment = 'right';
    }
    const field = {
      field: column.key as string,
      width: column.width,
    };

    function generateSortLink() {
      if (!tableMeta) {
        return undefined;
      }

      let newSortDirection: Sort['kind'] = 'desc';
      if (sort?.field === column.key) {
        if (sort.kind === 'desc') {
          newSortDirection = 'asc';
        }
      }

      const newSort = `${newSortDirection === 'desc' ? '-' : ''}${column.key}`;

      return {
        ...location,
        query: {...location.query, [sortKey]: newSort},
      };
    }

    const canSort = isFieldSortable(field, tableMeta?.fields, true);

    const sortLink = (
      <SortLink
        align={alignment}
        title={column.name}
        direction={sort?.field === column.key ? sort.kind : undefined}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
    return sortLink;
  }

  const columnSortBy = eventView.getSorts();

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [cursorName]: newCursor},
    });
  };

  return (
    <Fragment>
      <Header>
        {showDeviceClassSelector && <DeviceClassSelector />}
        <StyledPagination size="xs" pageLinks={pageLinks} onCursor={handleCursor} />
      </Header>
      <GridContainer>
        <GridEditable
          isLoading={isLoading}
          data={data?.data as TableDataRow[]}
          columnOrder={eventViewColumns
            .filter((col: TableColumn<React.ReactText>) => col.name !== 'project.name')
            .map((col: TableColumn<React.ReactText>) => {
              return {...col, name: columnNameMap[col.key]};
            })}
          columnSortBy={columnSortBy}
          location={location}
          grid={{
            renderHeadCell: column => renderHeadCell(column, data?.meta),
            renderBodyCell,
          }}
        />
      </GridContainer>
    </Fragment>
  );
}

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  margin-bottom: ${space(1)};
  align-items: center;
  height: 26px;
`;

const IconWrapper = styled('div')`
  text-align: right;
  width: 100%;
  height: 26px;
`;

// Not pretty but we need to override gridEditable styles since the original
// styles have too much padding for small spaces
const GridContainer = styled('div')`
  margin-bottom: ${space(1)};
  th {
    padding: 0 ${space(1)};
  }
  th:first-child {
    padding-left: ${space(2)};
  }
  th:last-child {
    padding-right: ${space(2)};
  }
  td {
    padding: ${space(0.5)} ${space(1)};
  }
  td:first-child {
    padding-right: ${space(1)};
    padding-left: ${space(2)};
  }
`;
