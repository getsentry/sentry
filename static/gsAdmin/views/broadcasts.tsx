import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {ConfigStore} from 'sentry/stores/configStore';

import {CreateBroadcastModal} from 'admin/components/createBroadcastModal';
import {PageHeader} from 'admin/components/pageHeader';

const getRow = (row: any) => [
  <SimpleTable.RowCell key="title" direction="column" align="start" gap="xs">
    <strong>
      <Link to={`/_admin/broadcasts/${row.id}/`}>{row.title}</Link>
    </strong>
    <Text size="xs">
      <a href={row.link}>{row.link}</a>
    </Text>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="users" justify="center">
    {row.userCount >= 0 ? row.userCount.toLocaleString() : ''}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="status" justify="center">
    {row.isActive ? 'Active' : 'Inactive'}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="expires" justify="end">
    {row.dateExpires ? moment(row.dateExpires).fromNow() : '∞'}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="created" justify="end">
    {moment(row.dateCreated).fromNow()}
  </SimpleTable.RowCell>,
];

export function Broadcasts() {
  const {openModal} = useModal();

  const hasPermission = ConfigStore.get('user').permissions.has('broadcasts.admin');

  const handleNewBroadcast = () => {
    openModal(deps => <CreateBroadcastModal {...deps} />, {
      closeEvents: 'escape-key',
    });
  };

  return (
    <div>
      <PageHeader title="Broadcasts">
        <Button
          disabled={!hasPermission}
          tooltipProps={{
            title: hasPermission
              ? undefined
              : "You don't have the broadcasts.admin permission",
          }}
          onClick={handleNewBroadcast}
          variant="primary"
          size="sm"
        >
          New Broadcast
        </Button>
      </PageHeader>

      <ResultGrid
        inPanel
        path="/_admin/broadcasts/"
        endpoint="/broadcasts/?show=all"
        columns={[
          {key: 'title', label: 'Title'},
          {key: 'users', label: 'Users Seen', width: 120, align: 'center'},
          {key: 'status', label: 'Status', width: 80, align: 'center'},
          {key: 'expires', label: 'Expires', width: 120, align: 'right'},
          {key: 'created', label: 'Created', width: 120, align: 'right'},
        ]}
        columnsForRow={getRow}
        hasSearch
        sortOptions={[
          ['created', 'Date Created'],
          ['expires', 'Date Expires'],
        ]}
        defaultSort="created"
      />
    </div>
  );
}
