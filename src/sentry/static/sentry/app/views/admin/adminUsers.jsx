/* eslint-disable react/jsx-key */
import React from 'react';
import moment from 'moment';

import {t} from 'app/locale';
import Link from 'app/components/links/link';
import ResultGrid from 'app/components/resultGrid';

export const prettyDate = function(x) {
  return moment(x).format('ll');
};

class AdminUsers extends React.Component {
  getRow = row => [
    <td>
      <strong>
        <Link to={`/manage/users/${row.id}/`}>{row.username}</Link>
      </strong>
      <br />
      {row.email !== row.username && <small>{row.email}</small>}
    </td>,
    <td style={{textAlign: 'center'}}>{prettyDate(row.dateJoined)}</td>,
    <td style={{textAlign: 'center'}}>{prettyDate(row.lastLogin)}</td>,
  ];

  render() {
    const columns = [
      <th>User</th>,
      <th style={{textAlign: 'center', width: 150}}>Joined</th>,
      <th style={{textAlign: 'center', width: 150}}>Last Login</th>,
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

export default AdminUsers;
