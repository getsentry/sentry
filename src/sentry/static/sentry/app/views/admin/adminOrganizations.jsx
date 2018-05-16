/* eslint-disable getsentry/jsx-needs-il8n */
/* eslint-disable react/jsx-key */
import React from 'react';
import {Link} from 'react-router';

import ResultGrid from 'app/components/resultGrid';
import {t} from 'app/locale';

class AdminOrganizations extends React.Component {
  getRow = row => {
    return [
      <td>
        <strong>
          <Link to={`/${row.slug}/`}>{row.name}</Link>
        </strong>
        <br />
        <small>{row.slug}</small>
      </td>,
    ];
  };

  render() {
    let columns = [<th>Organization</th>];

    return (
      <div>
        <h3>{t('Organizations')}</h3>
        <ResultGrid
          path="/manage/organizations/"
          endpoint={'/organizations/?show=all'}
          method="GET"
          columns={columns}
          columnsForRow={this.getRow}
          hasSearch={true}
          sortOptions={[
            ['date', 'Date Joined'],
            ['members', 'Members'],
            ['events', 'Events'],
            ['projects', 'Projects'],
            ['employees', 'Employees'],
          ]}
          defaultSort="date"
          {...this.props}
        />
      </div>
    );
  }
}

export default AdminOrganizations;
