import {Tag} from 'sentry/components/core/badge/tag';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {DateTime} from 'sentry/components/dateTime';

import ResultGrid from 'admin/components/resultGrid';

type Props = Partial<React.ComponentProps<typeof ResultGrid>> & {
  orgId: string;
  region: string;
};

const getRow = (orgId: string, region: string, row: any) => [
  <td key="name">
    {row.invoiceID ? (
      <Link to={`/_admin/customers/${orgId}/invoices/${region}/${row.invoiceID}/`}>
        <DateTime date={row.dateCreated} />
      </Link>
    ) : (
      <DateTime date={row.dateCreated} />
    )}
  </td>,
  <td key="stripeId" style={{textAlign: 'center'}}>
    {row.stripeID ? (
      <ExternalLink href={`https://dashboard.stripe.com/charges/${row.stripeID}`}>
        {row.stripeID}
      </ExternalLink>
    ) : (
      'n/a'
    )}
  </td>,
  <td key="status" style={{textAlign: 'center'}}>
    <Tag variant={row.isPaid ? 'success' : 'warning'}>
      {row.isPaid ? 'paid' : row.failureCode}
    </Tag>
  </td>,
  <td key="card" style={{textAlign: 'center'}}>
    {row.cardLast4 ? `··· ${row.cardLast4}` : 'n/a'}
  </td>,
  <td key="amount" style={{textAlign: 'right'}}>
    ${(row.amount / 100).toLocaleString()}
    <br />
    {row.isRefunded && (
      <small>(${(row.amountRefunded / 100).toLocaleString()} refunded)</small>
    )}
  </td>,
];

function CustomerCharges({orgId, region, ...props}: Props) {
  return (
    <ResultGrid
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/customers/${orgId}/charges/`}
      method="GET"
      defaultParams={{per_page: 10}}
      useQueryString={false}
      columns={[
        <th key="name">Charge</th>,
        <th key="stripeId" style={{width: 150, textAlign: 'center'}}>
          Stripe ID
        </th>,
        <th key="status" style={{width: 150, textAlign: 'center'}}>
          Status
        </th>,
        <th key="card" style={{width: 100, textAlign: 'center'}}>
          Card
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

export default CustomerCharges;
