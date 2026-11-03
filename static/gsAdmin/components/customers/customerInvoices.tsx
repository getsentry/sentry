import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

type Props = Partial<React.ComponentProps<typeof ResultGrid>> & {
  orgId: string;
  // TODO(cells) region here is actually a cell
  region: string;
};

const getRow = (region: string, row: any) => [
  <SimpleTable.RowCell key="name">
    <Link to={`/_admin/invoices/${region}/${row.id}/`}>
      {moment(row.dateCreated).format('ll')}
    </Link>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="status" justify="center">
    <Tag variant={row.isPaid ? 'success' : row.isClosed ? 'danger' : 'warning'}>
      {row.isPaid ? 'Paid' : row.isClosed ? 'Closed' : 'Pending'}
    </Tag>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="amount" direction="column" align="end" gap="xs">
    ${(row.amount / 100).toLocaleString()}
    {row.isRefunded && (
      <Text size="xs">(${(row.amountRefunded / 100).toLocaleString()} refunded)</Text>
    )}
  </SimpleTable.RowCell>,
];

export function CustomerInvoices({orgId, region, ...props}: Props) {
  return (
    <ResultGrid
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/customers/${orgId}/invoices/`}
      method="GET"
      defaultParams={{per_page: 10}}
      columns={[
        {key: 'name', label: 'Invoice'},
        {key: 'status', label: 'Status', width: 100, align: 'center'},
        {key: 'amount', label: 'Amount', width: 150, align: 'right'},
      ]}
      columnsForRow={row => getRow(region, row)}
      {...props}
    />
  );
}
