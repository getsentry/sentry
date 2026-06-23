import {Tag, type TagProps} from '@sentry/scraps/badge';
import {Link} from '@sentry/scraps/link';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getCells} from 'sentry/utils/cells';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useParams} from 'sentry/utils/useParams';

import {DetailLabel} from 'admin/components/detailLabel';
import {DetailList} from 'admin/components/detailList';
import {DetailsContainer} from 'admin/components/detailsContainer';
import {DetailsPage} from 'admin/components/detailsPage';
import {ResultTable} from 'admin/components/resultTable';
import {prettyDate} from 'admin/utils';
import type {Invoice, InvoiceItem} from 'getsentry/types';
import {InvoiceStatus} from 'getsentry/types';

export function PlatformInvoiceDetails() {
  const {invoiceId, region} = useParams<{
    invoiceId: string;
    region: string;
  }>();
  const cellInfo = getCells().find(c => c.name.toLowerCase() === region.toLowerCase());
  const QUERY_KEY: ApiQueryKey = [
    getApiUrl('/_admin/cells/$region/admin-platform-invoices/$invoiceId/', {
      path: {region, invoiceId},
    }),
    {
      host: cellInfo ? cellInfo.locality_url : '',
    },
  ];

  const {
    data: invoice,
    isPending,
    isError,
    refetch,
  } = useApiQuery<Invoice>(QUERY_KEY, {
    staleTime: 0,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const {customer} = invoice;

  const getItemDescription = (item: InvoiceItem) => {
    if (item.description) {
      return item.description;
    }
    return 'Unlabeled item';
  };

  const invoiceStatus = invoice.isPaid
    ? InvoiceStatus.PAID
    : invoice.isClosed
      ? InvoiceStatus.CLOSED
      : InvoiceStatus.AWAITING_PAYMENT;

  const invoiceStatusTagType: Record<InvoiceStatus, TagProps['variant']> = {
    [InvoiceStatus.PAID]: 'success',
    [InvoiceStatus.CLOSED]: 'danger',
    [InvoiceStatus.AWAITING_PAYMENT]: 'warning',
  };

  const overviewPanel = (
    <DetailsContainer>
      <DetailList>
        <DetailLabel title="Customer">
          {customer.isDeleted ? (
            <span>
              {customer.slug} <small>(deleted)</small>
            </span>
          ) : (
            <Link to={`/_admin/customers/${customer.slug}/`}>{customer.name}</Link>
          )}
        </DetailLabel>
        <DetailLabel title="Status">
          <Tag variant={invoiceStatusTagType[invoiceStatus]}>{invoiceStatus}</Tag>
        </DetailLabel>
        <DetailLabel title="Date Created">{prettyDate(invoice.dateCreated)}</DetailLabel>
        <DetailLabel title="Amount">
          ${(invoice.amount / 100).toLocaleString()}
        </DetailLabel>
        <DetailLabel title="Charge Attempts">
          {invoice.chargeAttempts === null
            ? 'n/a'
            : invoice.chargeAttempts.toLocaleString()}
          {invoice.nextChargeAttempt && (
            <div>
              <small>next attempt on {prettyDate(invoice.nextChargeAttempt)}</small>
            </div>
          )}
        </DetailLabel>
      </DetailList>
      <DetailList>
        <DetailLabel title="ID">{invoice.id}</DetailLabel>
        <DetailLabel title="Type">{invoice.type || 'n/a'}</DetailLabel>
        <DetailLabel title="Channel">{invoice.channel || 'n/a'}</DetailLabel>
        <DetailLabel title="Stripe ID">
          {invoice.stripeInvoiceID ? (
            <a href={`https://dashboard.stripe.com/invoices/${invoice.stripeInvoiceID}`}>
              {invoice.stripeInvoiceID}
            </a>
          ) : (
            'n/a'
          )}
        </DetailLabel>
        <DetailLabel title="Effective At">
          {invoice.effectiveAt ? prettyDate(invoice.effectiveAt) : 'n/a'}
        </DetailLabel>
        <DetailLabel title="Source">
          <Tag variant="highlight">Platform</Tag>
        </DetailLabel>
      </DetailList>
    </DetailsContainer>
  );

  const invoiceTable = (
    <ResultTable>
      <thead>
        <tr>
          <th>Item</th>
          <th style={{width: 150, textAlign: 'right'}}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {invoice.items.map((item, num) => (
          <tr key={num}>
            <td>{getItemDescription(item)}</td>
            <td data-label="Amount" style={{textAlign: 'right'}}>
              ${(item.amount / 100).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </ResultTable>
  );

  const chargesTable = (
    <ResultTable>
      <thead>
        <tr>
          <th>Charge</th>
          <th style={{width: 150, textAlign: 'center'}}>Stripe ID</th>
          <th style={{width: 150, textAlign: 'center'}}>Status</th>
          <th style={{width: 100, textAlign: 'center'}}>Card</th>
          <th style={{width: 150, textAlign: 'right'}}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {invoice.charges.map(row => (
          <tr key={row.id}>
            <td>
              <DateTime date={row.dateCreated} />
            </td>
            <td data-label="Stripe ID" style={{textAlign: 'center'}}>
              {row.stripeID ? (
                <a href={`https://dashboard.stripe.com/charges/${row.stripeID}`}>
                  {row.stripeID}
                </a>
              ) : (
                'n/a'
              )}
            </td>
            <td data-label="Status" style={{textAlign: 'center'}}>
              {row.isPaid ? (
                <Tag variant="success">Paid</Tag>
              ) : (
                <Tag variant="danger">{row.failureCode}</Tag>
              )}
            </td>
            <td data-label="Card" style={{textAlign: 'center'}}>
              {row.cardLast4 ? `··· ${row.cardLast4}` : 'n/a'}
            </td>
            <td data-label="Amount" style={{textAlign: 'right'}}>
              ${(row.amount / 100).toLocaleString()}
              <br />
              {row.isRefunded && (
                <small>({(row.amountRefunded / 100).toLocaleString()} refunded)</small>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </ResultTable>
  );

  return (
    <DetailsPage
      rootName="Platform Invoices"
      name={invoice.id}
      actions={[]}
      sections={[
        {
          content: overviewPanel,
        },
        {
          noPadding: true,
          content: invoiceTable,
        },
        {
          noPadding: true,
          name: 'Charges',
          content: chargesTable,
        },
      ]}
    />
  );
}
