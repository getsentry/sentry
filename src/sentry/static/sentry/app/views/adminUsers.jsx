/* eslint-disable getsentry/jsx-needs-il8n */
/* eslint-disable react/jsx-key */
import React from 'react';
import moment from 'moment';

import ResultGrid from '../components/resultGrid';
import {t} from '../locale';

export const prettyDate = function(x) {
    return moment(x).format('ll');
};

const AdminUsers = React.createClass({
  getRow(row) {
    return [
      <td>
        <strong><a href={`/manage/users/${row.id}/`}>
          {row.username}
        </a></strong><br />
        {row.email !== row.username &&
          <small>{row.email}</small>
        }
      </td>,
      <td style={{textAlign: 'center'}}>{prettyDate(row.dateJoined)}</td>,
      <td style={{textAlign: 'center'}}>{prettyDate(row.lastLogin)}</td>
    ];
  },

  render() {
    let columns = [
      <th>User</th>,
      <th style={{textAlign: 'center', width: 150}}>Joined</th>,
      <th style={{textAlign: 'center', width: 150}}>Last Login</th>
    ];

    return (
      <div>
        <h3>{t('Users')}</h3>
        <ResultGrid
          path="/manage/users/"
          endpoint={`/users/`}
          method="GET"
          columns={columns}
          columnsForRow={this.getRow}
          hasSearch={true}
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
          ]}
          defaultSort="date"
          {...this.props} />
      </div>
    );
  },
});

export default AdminUsers;
