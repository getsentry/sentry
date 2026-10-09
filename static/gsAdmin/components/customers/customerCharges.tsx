import {Tag} from '@sentry/scraps/badge';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

type Props = Partial<React.ComponentProps<typeof ResultGrid>> & {
  orgId: string;
  region: string;
};

const getRow = (region: string, row: any) => [
  <SimpleTable.RowCell key="name">
    {row.invoiceID ? (
      <Link to={`/_admin/invoices/${region}/${row.invoiceID}/`}>
        <DateTime date={row.dateCreated} />
      </Link>
    ) : (
      <DateTime date={row.dateCreated} />
    )}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="stripeId" justify="center">
    {row.stripeID ? (
      <ExternalLink href={`https://dashboard.stripe.com/charges/${row.stripeID}`}>
        {row.stripeID}
      </ExternalLink>
    ) : (
      'n/a'
    )}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="status" justify="center">
    <Tag variant={row.isPaid ? 'success' : 'warning'}>
      {row.isPaid ? 'paid' : row.failureCode}
    </Tag>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="card" justify="center">
    {row.cardLast4 ? `··· ${row.cardLast4}` : 'n/a'}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="amount" direction="column" align="end" gap="xs">
    ${(row.amount / 100).toLocaleString()}
    {row.isRefunded && (
      <Text size="xs">(${(row.amountRefunded / 100).toLocaleString()} refunded)</Text>
    )}
  </SimpleTable.RowCell>,
];

export function CustomerCharges({orgId, region, ...props}: Props) {
  return (
    <ResultGrid
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/customers/${orgId}/charges/`}
      method="GET"
      defaultParams={{per_page: 10}}
      useQueryString={false}
      columns={[
        {key: 'name', label: 'Charge'},
        {key: 'stripeId', label: 'Stripe ID', width: 150, align: 'center'},
        {key: 'status', label: 'Status', width: 150, align: 'center'},
        {key: 'card', label: 'Card', width: 100, align: 'center'},
        {key: 'amount', label: 'Amount', width: 150, align: 'right'},
      ]}
      columnsForRow={row => getRow(region, row)}
      {...props}
    />
  );
}
