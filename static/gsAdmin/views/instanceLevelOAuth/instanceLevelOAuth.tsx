import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {DateTime} from 'sentry/components/dateTime';

import PageHeader from 'admin/components/pageHeader';
import ResultGrid from 'admin/components/resultGrid';
import NewInstanceLevelOAuthClient from 'admin/views/instanceLevelOAuth/components/newInstanceLevelOAuthClient';

const getRow = (row: any) => [
  <td key="name">
    <strong>
      <Link to={`/_admin/instance-level-oauth/${row.clientID}/`}>{row.name}</Link>
    </strong>
  </td>,
  <td key="id" style={{textAlign: 'center'}}>
    {row.clientID}
  </td>,
  <td key="created" style={{textAlign: 'right'}}>
    <DateTime date={row.dateAdded} dateOnly year />
  </td>,
];

function InstanceLevelOAuth() {
  return (
    <div>
      <PageHeader title="Instance Level OAuth Clients">
        <Button
          onClick={() redesign => openModal(deps => <NewInstanceLevelOAuthClient {...deps} />)}
        >
          New Instance Level OAuth Client
        </Button>
      </PageHeader>
      <ResultGrid
        inPanel
        path="/_admin/instance-level-oauth/"
        endpoint="/_admin/instance-level-oauth/"
        method="GET"
        columns={[
          <th key="name">Name</th>,
          <th key="id" style={{width: 500, textAlign: 'center'}}>
            Client ID
          </th>,
          <th key="created" style={{width: 250, textAlign: 'right'}}>
            Created
          </th>,
        ]}
        columnsForRow={getRow}
        defaultSort="created"
      />
    </div>
  );
}

export default InstanceLevelOAuth;
