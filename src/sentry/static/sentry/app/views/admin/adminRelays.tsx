import React from 'react';
import {RouteComponentProps} from 'react-router';
import moment from 'moment';

import {Client} from 'app/api';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import ResultGrid from 'app/components/resultGrid';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';

const prettyDate = (x: string) => moment(x).format('ll LTS');

type Props = RouteComponentProps<{}, {}> & {api: Client};

type State = {
  loading: boolean;
};

type RelayRow = {
  id: string;
  relayId: string;
  publicKey: string;
  firstSeen: string;
  lastSeen: string;
};

class AdminRelays extends React.Component<Props, State> {
  state: State = {
    loading: false,
  };

  onDelete(key: string) {
    this.setState({loading: true});
    this.props.api.request(`/relays/${key}/`, {
      method: 'DELETE',
      success: () => this.setState({loading: false}),
      error: () => this.setState({loading: false}),
    });
  }

  getRow(row: RelayRow) {
    return [
      <td key="id">
        <strong>{row.relayId}</strong>
      </td>,
      <td key="key">{row.publicKey}</td>,
      <td key="firstSeen" style={{textAlign: 'right'}}>
        {prettyDate(row.firstSeen)}
      </td>,
      <td key="lastSeen" style={{textAlign: 'right'}}>
        {prettyDate(row.lastSeen)}
      </td>,
      <td key="tools" style={{textAlign: 'right'}}>
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
  }

  render() {
    const columns = [
      <th key="id" style={{width: 350, textAlign: 'left'}}>
        Relay
      </th>,
      <th key="key">Public Key</th>,
      <th key="firstSeen" style={{width: 150, textAlign: 'right'}}>
        First seen
      </th>,
      <th key="lastSeen" style={{width: 150, textAlign: 'right'}}>
        Last seen
      </th>,
      <th key="tools" />,
    ];

    return (
      <div>
        <h3>{t('Relays')}</h3>
        <ResultGrid
          path="/manage/relays/"
          endpoint="/relays/"
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

export {AdminRelays};

export default withApi(AdminRelays);
