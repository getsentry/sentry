import moment from 'moment-timezone';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {Truncate} from 'sentry/components/truncate';

import type {BeaconData} from 'admin/components/beacons/beaconOverview';

type Props = {
  data: BeaconData;
};

const getRow = (row: any) => [
  <SimpleTable.RowCell key="id">{moment(row.dateCreated).fromNow()}</SimpleTable.RowCell>,
  <SimpleTable.RowCell key="version" justify="center" overflow="visible">
    <Truncate maxLength={100} value={row.version} />
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
];

export function BeaconCheckins({data}: Props) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Beacon Checkins"
      path={`/_admin/beacons/${data.id}/`}
      endpoint={`/beacons/${data.id}/checkins/`}
      columns={[
        {key: 'id', label: 'Checkin'},
        {key: 'version', label: 'Version', width: 100, align: 'center'},
        {key: 'events', label: 'Events (24h)', width: 120, align: 'center'},
        {key: 'users', label: 'Users', width: 100, align: 'center'},
        {key: 'projects', label: 'Projects', width: 100, align: 'center'},
      ]}
      columnsForRow={getRow}
      defaultParams={{per_page: 10}}
      useQueryString={false}
    />
  );
}
