import {useCallback} from 'react';
import moment from 'moment-timezone';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import ConfigStore from 'sentry/stores/configStore';

import {CreateBroadcastModal} from 'admin/components/createBroadcastModal';
import PageHeader from 'admin/components/pageHeader';
import ResultGrid from 'admin/components/resultGrid';
import {getBroadcastSchema} from 'admin/schemas/broadcasts';

const getRow = (row: any) => [
  <td key="title">
    <strong>
      <Link to={`/_admin/broadcasts/${row.id}/`}>{row.title}</Link>
    </strong>
    <br />
    <small>
      <a href={row.link}>{row.link}</a>
    </small>
  </td>,
  <td key="users" style={{textAlign: 'center'}}>
    {row.userCount >= 0 ? row.userCount.toLocaleString() : ''}
  </td>,
  <td key="status" style={{textAlign: 'center'}}>
    {row.isActive ? 'Active' : 'Inactive'}
  </td>,
  <td key="expires" style={{textAlign: 'right'}}>
    {row.dateExpires ? moment(row.dateExpires).fromNow() : '∞'}
  </td>,
  <td key="created" style={{textAlign: 'right'}}>
    {moment(row.dateCreated).fromNow()}
  </td>,
];

export default function Broadcasts() {
  const hasPermission = ConfigStore.get('user').permissions.has('broadcasts.admin');
  const fields = getBroadcastSchema();

  const handleNewBroadcast = useCallback(() => {
    openModal(deps => <CreateBroadcastModal {...deps} fields={fields} />, {
      closeEvents: 'escape-key',
    });
  }, [fields]);

  return (
    <div>
      <PageHeader title="Broadcasts">
        <Button
          disabled={!hasPermission}
          title={
            hasPermission ? undefined : "You don't have the broadcasts.admin permission"
          }
          onClick={handleNewBroadcast}
          priority="primary"
          size="sm"
        >
          New Broadcast
        </Button>
      </PageHeader>

      <ResultGrid
        inPanel
        path="/_admin/broadcasts/"
        endpoint="/broadcasts/?show=all"
        method="GET"
        columns={[
          <th key="title">Title</th>,
          <th key="users" style={{width: 120, textAlign: 'center'}}>
            Users Seen
          </th>,
          <th key="status" style={{width: 80, textAlign: 'center'}}>
            Status
          </th>,
          <th key="expires" style={{width: 120, textAlign: 'right'}}>
            Expires
          </th>,
          <th key="created" style={{width: 120, textAlign: 'right'}}>
            Created
          </th>,
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
