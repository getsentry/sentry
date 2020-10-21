/* eslint-disable react/jsx-key */
import {Component} from 'react';
import moment from 'moment';

import ResultGrid from 'app/components/resultGrid';
import {t} from 'app/locale';

export const prettyDate = function (x) {
  return moment(x).format('ll');
};

class AdminProjects extends Component {
  getRow = row => [
    <td>
      <strong>
        <a href={`/${row.organization.slug}/${row.slug}/`}>{row.name}</a>
      </strong>
      <br />
      <small>{row.organization.name}</small>
    </td>,
    <td style={{textAlign: 'center'}}>{row.status}</td>,
    <td style={{textAlign: 'right'}}>{prettyDate(row.dateCreated)}</td>,
  ];

  render() {
    const columns = [
      <th>Project</th>,
      <th style={{width: 150, textAlign: 'center'}}>Status</th>,
      <th style={{width: 200, textAlign: 'right'}}>Created</th>,
    ];

    return (
      <div>
        <h3>{t('Projects')}</h3>
        <ResultGrid
          path="/manage/projects/"
          endpoint="/projects/?show=all"
          method="GET"
          columns={columns}
          columnsForRow={this.getRow}
          hasSearch
          filters={{
            status: {
              name: 'Status',
              options: [
                ['active', 'Active'],
                ['deleted', 'Deleted'],
              ],
            },
          }}
          sortOptions={[['date', 'Date Created']]}
          defaultSort="date"
          {...this.props}
        />
      </div>
    );
  }
}

export default AdminProjects;
