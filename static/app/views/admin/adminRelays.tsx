import {useCallback, useState} from 'react';
import moment from 'moment-timezone';

import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import ResultGrid from 'sentry/components/resultGrid';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';

const prettyDate = (x: string) => moment(x).format('ll LTS');

type RelayRow = {
  firstSeen: string;
  id: string;
  lastSeen: string;
  publicKey: string;
  relayId: string;
};

export default function AdminRelays() {
  const api = useApi();
  // TODO: Loading not hooked up to anything?
  const [, setLoading] = useState(false);

  const onDelete = useCallback(
    (key: string) => {
      setLoading(true);
      api.request(`/relays/${key}/`, {
        method: 'DELETE',
        success: () => setLoading(false),
        error: () => setLoading(false),
      });
    },
    [api]
  );

  const getRow = (row: RelayRow) => {
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
            onConfirm={() => onDelete(row.id)}
          >
            <Button priority="danger" size="sm" icon={<IconDelete />}>
              {t('Remove Relay')}
            </Button>
          </Confirm>
        </span>
      </td>,
    ];
  };

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
        columnsForRow={getRow}
        hasSearch={false}
        sortOptions={[
          ['firstSeen', 'First seen'],
          ['lastSeen', 'Last seen'],
          ['relayId', 'Relay ID'],
        ]}
        defaultSort="firstSeen"
      />
    </div>
  );
}
