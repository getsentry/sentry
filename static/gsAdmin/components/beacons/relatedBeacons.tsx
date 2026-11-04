import moment from 'moment-timezone';

import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {Truncate} from 'sentry/components/truncate';

import type {BeaconData} from 'admin/components/beacons/beaconOverview';

type Props = {
  data: BeaconData;
};

const getRow = (row: any) => [
  <SimpleTable.RowCell key="id" direction="column" align="start" gap="xs">
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
    <Truncate value={row.version} maxLength={100} />
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="events" justify="center">
    {row.events24h === null ? '' : row.events24h.toLocaleString()}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="users" justify="center">
    {row.totalUsers === null ? '' : row.totalUsers.toLocaleString()}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="projects" justify="center">
    {row.totalProjects === null ? '' : row.totalProjects.toLocaleString()}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="firstCheckin" justify="end">
    {moment(row.firstCheckin).fromNow()}
  </SimpleTable.RowCell>,
];

export function RelatedBeacons({data}: Props) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Related Beacons"
      path={`/_admin/beacons/${data.id}/`}
      endpoint={`/beacons/${data.id}/related-beacons/`}
      columns={[
        {key: 'id', label: 'Beacon'},
        {key: 'version', label: 'Version', width: 100, align: 'center'},
        {key: 'events', label: 'Events (24h)', width: 120, align: 'center'},
        {key: 'users', label: 'Users', width: 100, align: 'center'},
        {key: 'projects', label: 'Projects', width: 100, align: 'center'},
        {key: 'firstCheckin', label: 'First Checkin', width: 200, align: 'right'},
      ]}
      columnsForRow={getRow}
      defaultParams={{per_page: 10}}
      useQueryString={false}
    />
  );
}
