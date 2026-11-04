import {Button} from '@sentry/scraps/button';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';

import {DateTime} from 'sentry/components/dateTime';
import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

import {PageHeader} from 'admin/components/pageHeader';
import {NewInstanceLevelOAuthClient} from 'admin/views/instanceLevelOAuth/components/newInstanceLevelOAuthClient';

const getRow = (row: any) => [
  <SimpleTable.RowCell key="name">
    <strong>
      <Link to={`/_admin/instance-level-oauth/${row.clientID}/`}>{row.name}</Link>
    </strong>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="id" justify="center">
    {row.clientID}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="created" justify="end">
    <DateTime date={row.dateAdded} dateOnly year />
  </SimpleTable.RowCell>,
];

export function InstanceLevelOAuth() {
  const {openModal} = useModal();

  return (
    <div>
      <PageHeader title="Instance Level OAuth Clients">
        <Button
          onClick={() => openModal(deps => <NewInstanceLevelOAuthClient {...deps} />)}
        >
          New Instance Level OAuth Client
        </Button>
      </PageHeader>
      <ResultGrid
        inPanel
        path="/_admin/instance-level-oauth/"
        endpoint="/_admin/instance-level-oauth/"
        columns={[
          {key: 'name', label: 'Name'},
          {key: 'id', label: 'Client ID', width: 500, align: 'center'},
          {key: 'created', label: 'Created', width: 250, align: 'right'},
        ]}
        columnsForRow={getRow}
        defaultSort="created"
      />
    </div>
  );
}
