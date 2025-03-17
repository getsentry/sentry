import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

import PageHeader from 'admin/components/pageHeader';
import ResultGrid from 'admin/components/resultGrid';

const getRow = (row: any) => [
  <td key="id">{row.id}</td>,
  <td key="email">{row.email}</td>,
  <td key="permission">{row.permission}</td>,
];

type Props = RouteComponentProps<unknown, unknown>;

function BillingAdmins(props: Props) {
  return (
    <div>
      <PageHeader title="Billing Admin Users" />

      <ResultGrid
        inPanel
        path="/_admin/billingadmins"
        endpoint="/billingadmins/"
        columns={[
          <th key="id">User Id</th>,
          <th key="email">Email</th>,
          <th key="permission">Permission</th>,
        ]}
        columnsForRow={getRow}
        {...props}
      />
    </div>
  );
}

export default BillingAdmins;
