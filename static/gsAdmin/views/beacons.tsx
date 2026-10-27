import moment from 'moment-timezone';

import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {Truncate} from 'sentry/components/truncate';

import {PageHeader} from 'admin/components/pageHeader';

const getRow = (row: any) => [
  <SimpleTable.RowCell key="beacon" direction="column" align="start" gap="xs">
    <strong>
      <Link to={`/_admin/beacons/${row.id}/`}>{row.installID.substring(0, 14)}</Link>
    </strong>
    {row.email && (
      <Text size="xs">
        <a href={`mailto:${row.email}`}>{row.email}</a>
      </Text>
    )}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="version" justify="center" overflow="visible">
    <Truncate maxLength={15} value={row.version} />
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="events" justify="center">
    {row.events24h?.toLocaleString() ?? ''}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="users" justify="center">
    {row.totalUsers?.toLocaleString() ?? ''}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="projects" justify="center">
    {row.totalProjects?.toLocaleString() ?? ''}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="checkin" justify="end">
    {moment(row.firstCheckin).fromNow()}
  </SimpleTable.RowCell>,
];

export function Beacons() {
  return (
    <div>
      <PageHeader title="Beacons" />

      <ResultGrid
        inPanel
        path="/_admin/beacons/"
        endpoint="/beacons/"
        columns={[
          {key: 'beacon', label: 'Beacon'},
          {key: 'version', label: 'Version', width: 100, align: 'center'},
          {key: 'events', label: 'Events (24h)', width: 130, align: 'center'},
          {key: 'users', label: 'Users', width: 100, align: 'center'},
          {key: 'projects', label: 'Projects', width: 100, align: 'center'},
          {key: 'checkin', label: 'First Checkin', width: 200, align: 'right'},
        ]}
        columnsForRow={getRow}
        hasSearch
        sortOptions={[
          ['date', 'First Checkin'],
          ['events', 'Events'],
          ['users', 'Users'],
          ['projects', 'Projects'],
        ]}
        defaultSort="date"
      />
    </div>
  );
}
