import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Link} from 'sentry/components/core/link';

import ResultGrid from 'admin/components/resultGrid';

type Props = Partial<React.ComponentProps<typeof ResultGrid>> & {
  orgId: string;
  region: string;
};

const getRow = (orgId: string, region: string, row: any) => [
  <td key="name">
    <Link to={`/_admin/customers/${orgId}/invoices/${region}/${row.id}/`}>
      {moment(row.dateCreated).format('ll')}
    </Link>
  </td>,
  <td key="stripeId" style={{textAlign: 'center'}}>
    <a href={`https://dashboard.stripe.com/invoices/${row.stripeInvoiceID}`}>
      {row.stripeInvoiceID}
    </a>
  </td>,
  <td key="channel" style={{textAlign: 'center'}}>
    {row.channel || 'n/a'}
  </td>,
  <td key="status" style={{textAlign: 'center'}}>
    <Tag variant={row.isPaid ? 'success' : row.isClosed ? 'danger' : 'warning'}>
      {row.isPaid ? 'Paid' : row.isClosed ? 'Closed' : 'Pending'}
    </Tag>
  </td>,
  <td key="amount" style={{textAlign: 'right'}}>
    ${(row.amount / 100).toLocaleString()}
    <br />
    {row.isRefunded && (
      <small>(${(row.amountRefunded / 100).toLocaleString()} refunded)</small>
    )}
  </td>,
];

function CustomerInvoices({orgId, region, ...props}: Props) {
  return (
    <ResultGrid
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/customers/${orgId}/invoices/`}
      method="GET"
      defaultParams={{per_page: 10}}
      columns={[
        <th key="name">Invoice</th>,
        <th key="stripeId" style={{width: 150, textAlign: 'center'}}>
          Stripe ID
        </th>,
        <th key="channel" style={{width: 100, textAlign: 'center'}}>
          Channel
        </th>,
        <th key="status" style={{width: 100, textAlign: 'center'}}>
          Status
        </th>,
        <th key="amount" style={{width: 150, textAlign: 'right'}}>
          Amount
        </th>,
      ]}
      columnsForRow={row => getRow(orgId, region, row)}
      {...props}
    />
  );
}

export default CustomerInvoices;
