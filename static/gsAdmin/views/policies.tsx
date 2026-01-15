import moment from 'moment-timezone';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import ConfigStore from 'sentry/stores/configStore';

import PageHeader from 'admin/components/pageHeader';
import AddPolicyModal from 'admin/components/policies/addPolicyModal';
import ResultGrid from 'admin/components/resultGrid';

const getRow = (row: any) => [
  <td key="policy">
    <strong>
      <Link to={`/_admin/policies/${row.slug}/`}>{row.name}</Link>
    </strong>
  </td>,
  <td key="version" style={{textAlign: 'center'}}>
    {row.version ? row.version : 'n/a'}
  </td>,
  <td key="updated" style={{textAlign: 'right'}}>
    {moment(row.updatedAt).fromNow()}
  </td>,
];

function Policies() {
  const hasPermission = ConfigStore.get('user').permissions.has('policies.admin');

  return (
    <div>
      <PageHeader title="Policies">
        <Button
          onClick={() => openModal(deps => <AddPolicyModal {...deps} />)}
          size="sm"
          disabled={!hasPermission}
          title={
            hasPermission ? undefined : "You don't have the policies.admin permission"
          }
        >
          Add Policy
        </Button>
      </PageHeader>

      <ResultGrid
        inPanel
        path="/_admin/policies/"
        endpoint="/policies/"
        method="GET"
        columns={[
          <th key="policy">Policy</th>,
          <th key="value" style={{width: 100, textAlign: 'center'}}>
            Version
          </th>,
          <th key="claims" style={{width: 150, textAlign: 'right'}}>
            Updated
          </th>,
        ]}
        columnsForRow={getRow}
      />
    </div>
  );
}

export default Policies;
