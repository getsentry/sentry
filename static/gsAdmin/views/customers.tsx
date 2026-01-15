import CustomerGrid from 'admin/components/customerGrid';
import PageHeader from 'admin/components/pageHeader';

function Customers() {
  return (
    <div>
      <PageHeader title="Customers" />
      <CustomerGrid endpoint="/customers/" />
    </div>
  );
}

export default Customers;
