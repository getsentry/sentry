import moment from 'moment-timezone';

import {Link} from 'sentry/components/core/link';
import ResultGrid from 'sentry/components/resultGrid';
import {t} from 'sentry/locale';

type Row = {
  dateJoined: string;
  email: string;
  id: string;
  lastLogin: string;
  username: string;
};

const getRow = (row: Row) => [
  <td key="username">
    <strong>
      <Link to={`/manage/users/${row.id}/`}>{row.username}</Link>
    </strong>
    <br />
    {row.email !== row.username && <small>{row.email}</small>}
  </td>,
  <td key="dateJoined" style={{textAlign: 'center'}}>
    {moment(row.dateJoined).format('ll')}
  </td>,
  <td key="lastLogin" style={{textAlign: 'center'}}>
    {moment(row.lastLogin).format('ll')}
  </td>,
];

export default function AdminUsers() {
  const columns = [
    <th key="username">User</th>,
    <th key="dateJoined" style={{textAlign: 'center', width: 150}}>
      Joined
    </th>,
    <th key="lastLogin" style={{textAlign: 'center', width: 150}}>
      Last Login
    </th>,
  ];

  return (
    <div>
      <h3>{t('Users')}</h3>
      <ResultGrid
        path="/manage/users/"
        endpoint="/users/"
        method="GET"
        columns={columns}
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
      />
    </div>
  );
}
