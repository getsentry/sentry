import {useState} from 'react';
import {IconDelete} from '@sentry/icons/delete';
import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Confirm} from 'sentry/components/confirm';
import {ResultGrid, type ResultGridColumn} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {useApi} from 'sentry/utils/useApi';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';

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

  const onDelete = async (key: string) => {
    setLoading(true);
    try {
      await api.requestPromise(`/relays/${key}/`, {
        method: 'DELETE',
      });
    } catch {
      addErrorMessage(t('Unable to delete relay'));
    } finally {
      setLoading(false);
    }
  };

  const getRow = (row: RelayRow) => {
    return [
      <SimpleTable.RowCell key="id">
        <strong>{row.relayId}</strong>
      </SimpleTable.RowCell>,
      <SimpleTable.RowCell key="key">{row.publicKey}</SimpleTable.RowCell>,
      <SimpleTable.RowCell key="firstSeen" justify="end">
        {prettyDate(row.firstSeen)}
      </SimpleTable.RowCell>,
      <SimpleTable.RowCell key="lastSeen" justify="end">
        {prettyDate(row.lastSeen)}
      </SimpleTable.RowCell>,
      <SimpleTable.RowCell key="tools" justify="end">
        <span className="editor-tools">
          <Confirm
            message={t('Are you sure you wish to delete this relay?')}
            onConfirm={() => void onDelete(row.id)}
          >
            <Button variant="danger" size="sm" icon={<IconDelete />}>
              {t('Remove Relay')}
            </Button>
          </Confirm>
        </span>
      </SimpleTable.RowCell>,
    ];
  };

  const columns: ResultGridColumn[] = [
    {key: 'id', label: 'Relay', width: 350},
    {key: 'key', label: 'Public Key'},
    {key: 'firstSeen', label: 'First seen', width: 150, align: 'right'},
    {key: 'lastSeen', label: 'Last seen', width: 150, align: 'right'},
    {key: 'tools', label: t('Actions'), hideLabel: true},
  ];

  return (
    <div>
      <BreadcrumbTitle title={t('Relays')} />
      <ResultGrid
        path="/manage/relays/"
        endpoint="/relays/"
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
