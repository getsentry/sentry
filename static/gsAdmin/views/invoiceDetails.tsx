import moment from 'moment-timezone';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Tag, type TagProps} from 'sentry/components/core/badge/tag';
import {Link} from 'sentry/components/core/link';
import {DateTime} from 'sentry/components/dateTime';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ConfigStore from 'sentry/stores/configStore';
import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

import openChangeEffectiveAtModal from 'admin/components/changeEffectiveAtAction';
import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsContainer from 'admin/components/detailsContainer';
import DetailsPage from 'admin/components/detailsPage';
import ResultTable from 'admin/components/resultTable';
import {isBillingAdmin, prettyDate} from 'admin/utils';
import type {Invoice, InvoiceItem} from 'getsentry/types';
import {InvoiceStatus} from 'getsentry/types';

const ERR_MESSAGE = 'There was an internal error updating this invoice';

export default function InvoiceDetails() {
  const {invoiceId, orgId, region} = useParams<{
    invoiceId: string;
    orgId: string;
    region: string;
  }>();
  const regionInfo = ConfigStore.get('regions').find(
    (r: any) => r.name.toLowerCase() === region.toLowerCase()
  );
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const QUERY_KEY: ApiQueryKey = [
    `/_admin/cells/${region}/admin-invoices/${invoiceId}/`,
    {
      host: regionInfo ? regionInfo.url : '',
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
  const isDeleted = customer.isDeleted;

  const updateCache = (updatedInvoice: Invoice) => {
    setApiQueryData<Invoice>(queryClient, QUERY_KEY, updatedInvoice);
  };

  const handleClose = async () => {
    try {
      const updatedInvoice = await api.requestPromise(
        `/_admin/cells/${region}/invoices/${invoiceId}/close/`,
        {
          method: 'PUT',
          host: regionInfo ? regionInfo.url : '',
        }
      );
      updateCache(updatedInvoice);
      addSuccessMessage('Invoice has been closed');
    } catch {
      addErrorMessage(ERR_MESSAGE);
    }
  };

  const handleRetry = async () => {
    try {
      const updatedInvoice = await api.requestPromise(
        `/customers/${orgId}/invoices/${invoiceId}/retry-payment/`,
        {
          method: 'PUT',
        }
      );
      updateCache(updatedInvoice);
      addSuccessMessage('Payment will be retried');
    } catch {
      addErrorMessage(ERR_MESSAGE);
    }
  };

  const handleEffectiveAt = async (effectiveAt: string) => {
    try {
      const updatedInvoice = await api.requestPromise(
        `/customers/${orgId}/invoices/${invoiceId}/effective-at/`,
        {
          method: 'PUT',
          data: {effectiveAt},
        }
      );
      updateCache(updatedInvoice);
      addSuccessMessage('Invoice effective at date updated');
    } catch {
      addErrorMessage(ERR_MESSAGE);
    }
  };

  const getItemDescription = (item: InvoiceItem) => {
    if (item.description) {
      return item.description;
    }

    const {plan, period} = item.data;

    if (item.type === 'subscription') {
      const from = prettyDate(period.start * 1000);
      const until = prettyDate(period.end * 1000);

      return period
        ? `${plan.name} subscription from ${from} until ${until}`
        : `${plan.name} subscription`;
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
            <td>
              {getItemDescription(item)}
              <br />
              {item.periodStart && item.periodEnd && (
                <small>{`${moment(item.periodStart).format('ll')} › ${moment(
                  item.periodEnd
                ).format('ll')}`}</small>
              )}
            </td>
            <td style={{textAlign: 'right'}}>${(item.amount / 100).toLocaleString()}</td>
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
            <td style={{textAlign: 'center'}}>
              {row.stripeID ? (
                <a href={`https://dashboard.stripe.com/charges/${row.stripeID}`}>
                  {row.stripeID}
                </a>
              ) : (
                'n/a'
              )}
            </td>
            <td style={{textAlign: 'center'}}>
              {row.isPaid ? (
                <Tag variant="success">Paid</Tag>
              ) : (
                <Tag variant="danger">{row.failureCode}</Tag>
              )}
            </td>
            <td style={{textAlign: 'center'}}>
              {row.cardLast4 ? `··· ${row.cardLast4}` : 'n/a'}
            </td>
            <td style={{textAlign: 'right'}}>
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
      rootName="Invoices"
      name={invoice.id}
      actions={[
        {
          key: 'closeInvoice',
          name: 'Close Invoice',
          help: 'Close this invoice and prevent charging it.',
          disabled: isDeleted || invoice.isClosed || !isBillingAdmin(),
          disabledReason: isDeleted
            ? 'Organization is deleted'
            : invoice.isClosed
              ? 'Invoice is already closed'
              : 'Requires billing admin permission',
          onAction: handleClose,
        },

        {
          key: 'retryPayment',
          name: 'Retry Payment',
          help: 'Schedule to retry payment on this invoice.',
          disabled: isDeleted || invoice.isPaid || !isBillingAdmin(),
          disabledReason: isDeleted
            ? 'Organization is deleted'
            : invoice.isPaid
              ? 'Invoice is paid'
              : 'Requires billing admin permission',
          onAction: handleRetry,
        },
        {
          key: 'changeEffectiveAt',
          name: 'Change Effective At Date',
          help: 'Change date used for ARR calculations.',
          disabled: isDeleted || !isBillingAdmin(),
          disabledReason: isDeleted
            ? 'Organization is deleted'
            : 'Requires billing admin permission',
          skipConfirmModal: true,
          onAction: () => openChangeEffectiveAtModal({onAction: handleEffectiveAt}),
        },
      ]}
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
