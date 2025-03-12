import moment from 'moment-timezone';

import Truncate from 'sentry/components/truncate';

import type {BeaconData} from 'admin/components/beacons/beaconOverview';
import ResultGrid from 'admin/components/resultGrid';

type Props = {
  data: BeaconData;
};

const getRow = (row: any) => [
  <td key="id">{moment(row.dateCreated).fromNow()}</td>,
  <td key="version" style={{textAlign: 'center'}}>
    <Truncate maxLength={100} value={row.version} />
  </td>,
  <td key="events" style={{textAlign: 'center'}}>
    {row.events24h === null ? '' : row.events24h.toLocaleString()}
  </td>,
  <td key="users" style={{textAlign: 'center'}}>
    {row.totalUsers === null ? '' : row.totalUsers.toLocaleString()}
  </td>,
  <td key="projects" style={{textAlign: 'center'}}>
    {row.totalProjects === null ? '' : row.totalProjects.toLocaleString()}
  </td>,
];

function BeaconCheckins({data}: Props) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Beacon Checkins"
      path={`/_admin/beacons/${data.id}/`}
      endpoint={`/beacons/${data.id}/checkins/`}
      method="GET"
      columns={[
        <th key="id">Checkin</th>,
        <th key="version" style={{width: 100, textAlign: 'center'}}>
          Version
        </th>,
        <th key="events" style={{width: 120, textAlign: 'center'}}>
          Events (24h)
        </th>,
        <th key="users" style={{width: 100, textAlign: 'center'}}>
          Users
        </th>,
        <th key="projects" style={{width: 100, textAlign: 'center'}}>
          Projects
        </th>,
      ]}
      columnsForRow={getRow}
      defaultParams={{per_page: 10}}
      useQueryString={false}
    />
  );
}

export default BeaconCheckins;
