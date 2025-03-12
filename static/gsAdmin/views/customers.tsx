import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

import CustomerGrid from 'admin/components/customerGrid';
import PageHeader from 'admin/components/pageHeader';

type Props = RouteComponentProps<unknown, unknown>;

function Customers(props: Props) {
  return (
    <div>
      <PageHeader title="Customers" />
      <CustomerGrid endpoint="/customers/" {...props} />
    </div>
  );
}

export default Customers;
