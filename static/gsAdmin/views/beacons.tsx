import moment from 'moment-timezone';

import {Link} from 'sentry/components/core/link';
import Truncate from 'sentry/components/truncate';

import PageHeader from 'admin/components/pageHeader';
import ResultGrid from 'admin/components/resultGrid';

const getRow = (row: any) => [
  <td key="beacon">
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
    <Truncate maxLength={15} value={row.version} />
  </td>,
  <td key="events" style={{textAlign: 'center'}}>
    {row.events24h?.toLocaleString() ?? ''}
  </td>,
  <td key="users" style={{textAlign: 'center'}}>
    {row.totalUsers?.toLocaleString() ?? ''}
  </td>,
  <td key="projects" style={{textAlign: 'center'}}>
    {row.totalProjects?.toLocaleString() ?? ''}
  </td>,
  <td key="checkin" style={{textAlign: 'right'}}>
    {moment(row.firstCheckin).fromNow()}
  </td>,
];

export default function Beacons() {
  return (
    <div>
      <PageHeader title="Beacons" />

      <ResultGrid
        inPanel
        path="/_admin/beacons/"
        endpoint="/beacons/"
        method="GET"
        columns={[
          <th key="beacon">Beacon</th>,
          <th key="version" style={{width: 100, textAlign: 'center'}}>
            Version
          </th>,
          <th key="events" style={{width: 130, textAlign: 'center'}}>
            Events (24h)
          </th>,
          <th key="users" style={{width: 100, textAlign: 'center'}}>
            Users
          </th>,
          <th key="projects" style={{width: 100, textAlign: 'center'}}>
            Projects
          </th>,
          <th key="checkin" style={{width: 200, textAlign: 'right'}}>
            First Checkin
          </th>,
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
