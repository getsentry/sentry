import moment from 'moment-timezone';

import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import Truncate from 'sentry/components/truncate';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

import PageHeader from 'admin/components/pageHeader';
import ResultGrid from 'admin/components/resultGrid';

type Props = RouteComponentProps<unknown, unknown>;

const getRow = (row: any) => [
  <td key="user">
    <Link to={`/_admin/users/${row.id}/`}>
      <UserBadge
        hideEmail
        user={row}
        displayName={<Truncate maxLength={40} value={row.name} />}
      />
    </Link>
  </td>,
  <td key="email" style={{textAlign: 'center'}}>
    {row.username}
    <br />
    {row.username !== row.email && row.email}
  </td>,
  <td key="status" style={{textAlign: 'center'}}>
    {row.isActive ? 'Active' : 'Disabled'}
  </td>,
  <td key="joined" style={{textAlign: 'right'}}>
    {moment(row.dateJoined).fromNow()}
  </td>,
];

function Users(props: Props) {
  return (
    <div>
      <PageHeader title="Users" />
      <ResultGrid
        inPanel
        path="/_admin/users/"
        endpoint="/users/"
        method="GET"
        columns={[
          <th key="user">User</th>,
          <th key="email" style={{width: 100, textAlign: 'center'}}>
            Email
          </th>,
          <th key="status" style={{width: 100, textAlign: 'center'}}>
            Status
          </th>,
          <th key="joined" style={{width: 200, textAlign: 'right'}}>
            Joined
          </th>,
        ]}
        columnsForRow={getRow}
        hasSearch
        filters={{
          status: {
            name: 'Status',
            options: [
              ['active', 'Active'],
              ['disabled', 'Disabled'],
            ],
          },
        }}
        sortOptions={[['date', 'Date Joined']]}
        defaultSort="date"
        {...props}
      />
    </div>
  );
}

export default Users;
