/* eslint-disable getsentry/jsx-needs-il8n */
/* eslint-disable react/jsx-key */
import React from 'react';
import moment from 'moment';

import ResultGrid from '../components/resultGrid';
import {t} from '../locale';

const prettyDate = function(x) {
  return moment(x).format('ll LTS');
};

class AdminRelays extends React.Component {
  getRow = row => {
    return [
      <td>
        <strong>{row.relayId}</strong>
      </td>,
      <td>{row.publicKey}</td>,
      <td style={{textAlign: 'right'}}>{prettyDate(row.firstSeen)}</td>,
      <td style={{textAlign: 'right'}}>{prettyDate(row.lastSeen)}</td>,
    ];
  };

  render() {
    let columns = [
      <th style={{width: 350, textAlign: 'left'}}>Relay</th>,
      <th>Public Key</th>,
      <th style={{width: 150, textAlign: 'right'}}>First seen</th>,
      <th style={{width: 150, textAlign: 'right'}}>Last seen</th>,
    ];

    return (
      <div>
        <h3>{t('Relays')}</h3>
        <ResultGrid
          path="/manage/relays/"
          endpoint={'/relays/'}
          method="GET"
          columns={columns}
          columnsForRow={this.getRow}
          hasSearch={false}
          sortOptions={[
            ['firstSeen', 'First seen'],
            ['lastSeen', 'Last seen'],
            ['relayId', 'Relay ID'],
          ]}
          defaultSort="firstSeen"
          {...this.props}
        />
      </div>
    );
  }
}

export default AdminRelays;
