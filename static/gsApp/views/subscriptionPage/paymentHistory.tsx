import {Fragment} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconClose} from '@sentry/icons/close';
import {IconDownload} from '@sentry/icons/download';
import {IconTimer} from '@sentry/icons/timer';
import {IconWarning} from '@sentry/icons/warning';
import {skipToken, useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Tag, type TagProps} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Container, useResponsivePropValue} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import type {InvoiceBase} from 'getsentry/types';
import {formatCurrency} from 'getsentry/utils/formatCurrency';
import {ContactBillingMembers} from 'getsentry/views/contactBillingMembers';
import {SubscriptionPageContainer} from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

enum ReceiptStatus {
  PAID = 'paid',
  REFUNDED = 'refunded',
  CLOSED = 'closed',
  AWAITING_PAYMENT = 'awaiting_payment',
}

function ReceiptStatusTag({payment}: {payment: InvoiceBase}) {
  const status = payment.amountRefunded
    ? ReceiptStatus.REFUNDED
    : payment.isPaid
      ? ReceiptStatus.PAID
      : payment.isClosed
        ? ReceiptStatus.CLOSED
        : ReceiptStatus.AWAITING_PAYMENT;
  let icon = <IconWarning />;
  let tagType: TagProps['variant'] = 'warning';

  switch (status) {
    case ReceiptStatus.PAID:
      icon = <IconCheckmark />;
      tagType = 'success';
      break;
    case ReceiptStatus.CLOSED:
      icon = <IconClose />;
      tagType = 'danger';
      break;
    case ReceiptStatus.REFUNDED:
      icon = <IconTimer />;
      tagType = 'promotion';
      break;
    default:
      icon = <IconWarning />;
      tagType = 'warning';
      break;
  }

  return (
    <Tag icon={icon} variant={tagType}>
      {capitalize(status.replace('_', ' '))}
    </Tag>
  );
}

/**
 * Invoice/Payment list view.
 */
function PaymentHistory() {
  const organization = useOrganization();
  const location = useLocation();
  const hasBillingPerms = organization.access?.includes('org:billing');

  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<InvoiceBase[]>()('/customers/$organizationIdOrSlug/invoices/', {
      path: hasBillingPerms ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {cursor: location.query.cursor},
      staleTime: 0,
    }),
    select: selectJsonWithHeaders,
  });

  const paymentsPageLinks = data?.headers.Link;

  return (
    <SubscriptionPageContainer>
      <SentryDocumentTitle title={t('Receipts')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('Receipts')} />
      {hasBillingPerms ? (
        <Fragment>
          <ReceiptTable
            isError={isError}
            isPending={isPending}
            onRetry={refetch}
            organization={organization}
            payments={data?.json}
          />
          {paymentsPageLinks && <Pagination pageLinks={paymentsPageLinks} />}
        </Fragment>
      ) : (
        <ContactBillingMembers />
      )}
    </SubscriptionPageContainer>
  );
}

const COLUMNS: TableColumnConfig[] = [
  {key: 'date', width: 'minmax(min-content, 1fr)'},
  {key: 'amount', width: 'minmax(max-content, 1fr)'},
  {
    key: 'status',
    width: {zero: 'minmax(112px, max-content)', sm: 'minmax(max-content, 1fr)'},
  },
  {key: 'receiptId', width: 'minmax(0, 1fr)', visible: {sm: true}},
  {key: 'download', width: {zero: 'max-content', xl: 'minmax(max-content, 2fr)'}},
];

function ReceiptTable({
  isError,
  isPending,
  onRetry,
  organization,
  payments,
}: {
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  organization: Organization;
  payments: InvoiceBase[] | undefined;
}) {
  const isSmallContainer = useResponsivePropValue({zero: true, xl: false});

  return (
    <SimpleTable
      aria-label={t('Receipts')}
      columns={COLUMNS}
      data-test-id="payment-list"
      scrollable
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Date')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell align="right">{t('Amount')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Receipt ID')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell />
        </SimpleTable.HeaderRow>
      }
    >
      {isError ? (
        <SimpleTable.Error onRetry={onRetry} />
      ) : isPending ? (
        <SimpleTable.Loading />
      ) : payments?.length ? (
        payments.map(payment => (
          <SimpleTable.Row key={payment.id}>
            <SimpleTable.RowCell>
              <Link to={`/settings/${organization.slug}/billing/receipts/${payment.id}/`}>
                {moment(payment.dateCreated).format('MMM D, YYYY')}
              </Link>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell justify="end">
              <Container>
                <Text align="right">{formatCurrency(payment.amountBilled ?? 0)}</Text>
                {!!payment.amountRefunded && (
                  <Text size="sm" align="right">
                    {tct('[amount] refunded', {
                      amount: formatCurrency(payment.amountRefunded),
                    })}
                  </Text>
                )}
              </Container>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <ReceiptStatusTag payment={payment} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text monospace ellipsis>
                {payment.id}
              </Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell justify="end">
              <LinkButton
                aria-label={t('Download PDF')}
                icon={<IconDownload />}
                href={payment.receipt.url}
              >
                {isSmallContainer ? undefined : t('Download PDF')}
              </LinkButton>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))
      ) : (
        <SimpleTable.Empty>{t('No receipts found')}</SimpleTable.Empty>
      )}
    </SimpleTable>
  );
}

export default PaymentHistory;
