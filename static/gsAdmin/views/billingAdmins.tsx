import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

import {PageHeader} from 'admin/components/pageHeader';

const getRow = (row: any) => [
  <SimpleTable.RowCell key="id">{row.id}</SimpleTable.RowCell>,
  <SimpleTable.RowCell key="email">{row.email}</SimpleTable.RowCell>,
  <SimpleTable.RowCell key="permission">{row.permission}</SimpleTable.RowCell>,
];

export function BillingAdmins() {
  return (
    <div>
      <PageHeader title="Billing Admin Users" />

      <ResultGrid
        inPanel
        path="/_admin/billingadmins"
        endpoint="/billingadmins/"
        columns={[
          {key: 'id', label: 'User Id'},
          {key: 'email', label: 'Email'},
          {key: 'permission', label: 'Permission'},
        ]}
        columnsForRow={getRow}
      />
    </div>
  );
}
