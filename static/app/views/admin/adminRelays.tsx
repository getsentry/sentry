import {Component} from 'react';
import moment from 'moment-timezone';

import type {Client} from 'sentry/api';
import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import ResultGrid from 'sentry/components/resultGrid';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import withApi from 'sentry/utils/withApi';

const prettyDate = (x: string) => moment(x).format('ll LTS');

type Props = RouteComponentProps & {api: Client};

type State = {
  loading: boolean;
};

type RelayRow = {
  firstSeen: string;
  id: string;
  lastSeen: string;
  publicKey: string;
  relayId: string;
};

class AdminRelays extends Component<Props, State> {
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
          <Confirm
            message={t('Are you sure you wish to delete this relay?')}
            onConfirm={() => this.onDelete(row.id)}
          >
            <Button priority="danger" size="sm" icon={<IconDelete />}>
              {t('Remove Relay')}
            </Button>
          </Confirm>
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

export default withApi(AdminRelays);
