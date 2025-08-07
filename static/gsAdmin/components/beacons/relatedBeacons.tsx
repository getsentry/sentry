import moment from 'moment-timezone';

import {Link} from 'sentry/components/core/link';
import Truncate from 'sentry/components/truncate';

import type {BeaconData} from 'admin/components/beacons/beaconOverview';
import ResultGrid from 'admin/components/resultGrid';

type Props = {
  data: BeaconData;
};

const getRow = (row: any) => [
  <td key="id">
    <strong>
      <Link to={`/_admin/beacons/${row.id}/`}>{row.installID.substring(0, 14)}</Link>
    </strong>
    <br />
    {row.email && (
      <small>
        <a href={`mailto:${row.email}`}>{row.email}</a>
      </small>
    )}
  </td>,
  <td key="version" style={{textAlign: 'center'}}>
    <Truncate value={row.version} maxLength={100} />
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
  <td key="firstCheckin" style={{textAlign: 'right'}}>
    {moment(row.firstCheckin).fromNow()}
  </td>,
];

function RelatedBeacons({data}: Props) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Related Beacons"
      path={`/_admin/beacons/${data.id}/`}
      endpoint={`/beacons/${data.id}/related-beacons/`}
      method="GET"
      columns={[
        <th key="id">Beacon</th>,
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
        <th key="firstCheckin" style={{width: 200, textAlign: 'right'}}>
          First Checkin
        </th>,
      ]}
      columnsForRow={getRow}
      defaultParams={{per_page: 10}}
      useQueryString={false}
    />
  );
}

export default RelatedBeacons;
