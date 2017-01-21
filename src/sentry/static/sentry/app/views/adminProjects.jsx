/* eslint-disable getsentry/jsx-needs-il8n */
/* eslint-disable react/jsx-key */
import React from 'react';
import moment from 'moment';

import ResultGrid from '../components/resultGrid';
import {t} from '../locale';

export const prettyDate = function(x) {
    return moment(x).format('ll');
};

const AdminProjects = React.createClass({
  getRow(row) {
    return [
      <td>
        <strong><a href={`/${row.organization.slug}/${row.slug}/`}>
          {row.name}
        </a></strong><br />
        <small>{row.organization.name}</small>
      </td>,
      <td style={{textAlign: 'center'}}>{row.status}</td>,
      <td style={{textAlign: 'right'}}>{prettyDate(row.dateCreated)}</td>,
    ];
  },

  render() {
    let columns = [
      <th>Project</th>,
      <th style={{width: 150, textAlign: 'center'}}>Status</th>,
      <th style={{width: 200, textAlign: 'right'}}>Created</th>,
    ];

    return (
      <div>
        <h3>{t('Projects')}</h3>
        <ResultGrid
          path="/manage/projects/"
          endpoint={`/projects/`}
          method="GET"
          columns={columns}
          columnsForRow={this.getRow}
          hasSearch={true}
          filters={{
            status: {
              name: 'Status',
              options: [
                ['active', 'Active'],
                ['deleted', 'Deleted'],
              ],
            },
          }}
          sortOptions={[
            ['date', 'Date Created'],
          ]}
          defaultSort="date"
          {...this.props} />
      </div>
    );
  },
});

export default AdminProjects;
