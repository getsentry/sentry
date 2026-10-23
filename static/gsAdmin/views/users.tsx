import moment from 'moment-timezone';

import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {UserBadge} from 'sentry/components/idBadge/userBadge';
import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {Truncate} from 'sentry/components/truncate';

import {PageHeader} from 'admin/components/pageHeader';

const getRow = (row: any) => [
  <SimpleTable.RowCell key="user" overflow="visible">
    <Link to={`/_admin/users/${row.id}/`}>
      <UserBadge
        hideEmail
        user={row}
        displayName={<Truncate maxLength={40} value={row.name} />}
      />
    </Link>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="email" direction="column" gap="xs">
    <Text>{row.username}</Text>
    {row.username !== row.email && <Text>{row.email}</Text>}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="status" justify="center">
    {row.isActive ? 'Active' : 'Disabled'}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="joined" justify="end">
    {moment(row.dateJoined).fromNow()}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="lastActive" justify="end">
    {row.lastActive ? moment(row.lastActive).fromNow() : '—'}
  </SimpleTable.RowCell>,
];

export function Users() {
  return (
    <div>
      <PageHeader title="Users" />
      <ResultGrid
        inPanel
        path="/_admin/users/"
        endpoint="/users/"
        columns={[
          {key: 'user', label: 'User'},
          {key: 'email', label: 'Email', width: 100, align: 'center'},
          {key: 'status', label: 'Status', width: 100, align: 'center'},
          {key: 'joined', label: 'Joined', width: 200, align: 'right'},
          {key: 'lastActive', label: 'Last Active', width: 200, align: 'right'},
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
        sortOptions={[
          ['date', 'Date Joined'],
          ['lastActive', 'Last Active'],
        ]}
        defaultSort="date"
      />
    </div>
  );
}
