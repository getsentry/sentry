import {CustomerGrid} from 'admin/components/customerGrid';
import {PageHeader} from 'admin/components/pageHeader';

export function Customers() {
  return (
    <div>
      <PageHeader title="Customers" />
      <CustomerGrid endpoint="/customers/" />
    </div>
  );
}
