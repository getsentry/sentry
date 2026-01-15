import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconDownload} from 'sentry/icons';

import PageHeader from 'admin/components/pageHeader';
import ResultGrid, {type State as ResultGridState} from 'admin/components/resultGrid';
import {prettyDate} from 'admin/utils';

const getRow = (row: any, _rows: any[], state: ResultGridState) => [
  <td key="org">
    <strong>
      <Link
        to={`/_admin/customers/${row.customer.slug}/invoices/${state.region?.name}/${row.id}/`}
      >
        {row.id}
      </Link>
    </strong>
    <br />
    <small>{prettyDate(row.dateCreated)}</small>
  </td>,
  <td key="customer" style={{textAlign: 'center'}}>
    {row.customer.isDeleted ? (
      <span>
        {row.customer.slug} <small>(deleted)</small>
      </span>
    ) : (
      <Link to={`/_admin/customers/${row.customer.slug}/`}>{row.customer.name}</Link>
    )}
  </td>,
  <td key="stripe" style={{textAlign: 'center'}}>
    <a
      href={`https://dashboard.stripe.com/search?query=${row.stripeInvoiceID}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View in Stripe (${row.stripeInvoiceID})`}
    >
      View in Stripe
    </a>
  </td>,
  <td key="channel" style={{textAlign: 'center'}}>
    {row.channel || 'n/a'}
  </td>,
  <td key="status" style={{textAlign: 'center'}}>
    {row.isPaid ? 'Paid' : row.isClosed ? 'Unpaid' : 'Awaiting payment'}
  </td>,
  <td key="amount" style={{textAlign: 'right'}}>
    ${(row.amount / 100).toLocaleString()}
    <br />
    {row.isRefunded && (
      <small>(${(row.amountRefunded / 100).toLocaleString()} refunded)</small>
    )}
  </td>,
  <td key="download" style={{textAlign: 'right'}}>
    <LinkButton
      aria-label="Download Invoice"
      icon={<IconDownload />}
      href={`${state.region?.url}/api/0/_admin/cells/${state.region?.name}/payments/${row.id}/pdf/`}
      size="md"
      title="Download Invoice"
    />
  </td>,
];

function Invoices() {
  return (
    <div>
      <PageHeader title="Invoices" />
      <Panel>
        <PanelHeader>Usage</PanelHeader>
        <PanelBody withPadding>
          <p>The search bar supports the following query formats:</p>
          <ul>
            <li>
              <strong>Default search:</strong> Entering a value without a prefix will
              search for invoices by ID or GUID
            </li>
            <li>
              <strong>invoice_id:[ID]</strong> - Search by Stripe invoice ID (e.g.
              invoice_id:in_00000000)
            </li>
            <li>
              <strong>guid:[GUID]</strong> - Search by invoice GUID
            </li>
            <li>
              <strong>customer_id:[ID]</strong> - Search by customer ID
            </li>
            <li>
              <strong>id:[ID]</strong> - Search by internal invoice ID
            </li>
            <li>
              <strong>channel:[TYPE]</strong> - Filter by billing channel (self-serve,
              sales, partner)
            </li>
            <li>
              <strong>email:[EMAIL]</strong> - Search by user email
            </li>
            <li>
              <strong>org_name:"[NAME]"</strong> - Search by organization name (use quotes
              for names with spaces)
            </li>
            <li>
              <strong>org_slug:[SLUG]</strong> - Search by organization slug
            </li>
            <li>
              <strong>org_id:[ID]</strong> - Search by organization ID
            </li>
          </ul>
          <p>
            Multiple search terms can be combined with spaces (e.g.{' '}
            <code>channel:self-serve org_slug:my-org</code>)
          </p>
        </PanelBody>
      </Panel>
      <ResultGrid
        inPanel
        isRegional
        path="/_admin/invoices/"
        endpoint="/invoices/"
        method="GET"
        columns={[
          <th key="org">Invoice</th>,
          <th key="customer" style={{width: 150, textAlign: 'center'}}>
            Customer
          </th>,
          <th key="stripe" style={{width: 150, textAlign: 'center'}}>
            View in Stripe
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
          <th key="download" style={{width: 150, textAlign: 'right'}}>
            Download
          </th>,
        ]}
        columnsForRow={getRow}
        hasSearch
        filters={{
          isPaid: {
            name: 'Paid',
            options: [
              ['1', 'Yes'],
              ['0', 'No'],
            ],
          },
        }}
      />
    </div>
  );
}

export default Invoices;
