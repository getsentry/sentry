import {Location} from 'history';
import moment from 'moment';

import Link from 'sentry/components/links/link';
import ResultGrid from 'sentry/components/resultGrid';
import {t} from 'sentry/locale';
import AsyncView from 'sentry/views/asyncView';

export const prettyDate = function (x) {
  return moment(x).format('ll');
};

type Row = {
  dateJoined: string;
  email: string;
  id: string;
  lastLogin: string;
  username: string;
};

type Props = {
  location: Location;
} & AsyncView['props'];

export default class AdminUsers extends AsyncView<Props> {
  getRow = (row: Row) => [
    <td key="username">
      <strong>
        <Link to={`/manage/users/${row.id}/`}>{row.username}</Link>
      </strong>
      <br />
      {row.email !== row.username && <small>{row.email}</small>}
    </td>,
    <td key="dateJoined" style={{textAlign: 'center'}}>
      {prettyDate(row.dateJoined)}
    </td>,
    <td key="lastLogin" style={{textAlign: 'center'}}>
      {prettyDate(row.lastLogin)}
    </td>,
  ];

  render() {
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
          columnsForRow={this.getRow}
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
          {...this.props}
        />
      </div>
    );
  }
}
