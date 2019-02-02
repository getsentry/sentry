/* eslint-disable getsentry/jsx-needs-il8n */
/* eslint-disable react/jsx-key */
import React from 'react';
import moment from 'moment';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import withEnvironment from 'app/utils/withEnvironment';

import ResultGrid from 'app/components/resultGrid';
import LinkWithConfirmation from 'app/components/linkWithConfirmation';

const prettyDate = function(x) {
  return moment(x).format('ll LTS');
};

const AdminRelays = createReactClass({
  displayName: 'GroupEventDetails',

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
    };
  },

  onDelete(key) {
    this.setState({
      loading: true,
    });
    this.api.request(`/relays/${key}/`, {
      method: 'DELETE',
      success: () => {
        this.setState({
          loading: false,
        });
      },
      error: () => {
        this.setState({
          loading: false,
        });
      },
    });
  },

  getRow(row) {
    return [
      <td>
        <strong>{row.relayId}</strong>
      </td>,
      <td>{row.publicKey}</td>,
      <td style={{textAlign: 'right'}}>{prettyDate(row.firstSeen)}</td>,
      <td style={{textAlign: 'right'}}>{prettyDate(row.lastSeen)}</td>,
      <td style={{textAlign: 'right'}}>
        <span className="editor-tools">
          <LinkWithConfirmation
            className="danger"
            title="Remove"
            message={t('Are you sure you wish to delete this relay?')}
            onConfirm={() => this.onDelete(row.id)}
          >
            {t('Remove')}
          </LinkWithConfirmation>
        </span>
      </td>,
    ];
  },

  render() {
    const columns = [
      <th style={{width: 350, textAlign: 'left'}}>Relay</th>,
      <th>Public Key</th>,
      <th style={{width: 150, textAlign: 'right'}}>First seen</th>,
      <th style={{width: 150, textAlign: 'right'}}>Last seen</th>,
      <th />,
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
  },
});

export default withEnvironment(AdminRelays);
