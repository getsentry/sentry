import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {DateTime} from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import withOrganization from 'sentry/utils/withOrganization';

import withSubscription from 'getsentry/components/withSubscription';
import type {InvoiceBase, Subscription} from 'getsentry/types';
import {InvoiceStatus} from 'getsentry/types';
import formatCurrency from 'getsentry/utils/formatCurrency';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';

import SubscriptionHeader from './subscriptionHeader';
import {trackSubscriptionView} from './utils';

type Props = {
  organization: Organization;
  subscription: Subscription;
} & RouteComponentProps<unknown, unknown>;

/**
 * Invoice/Payment list view.
 */
function PaymentHistory({organization, subscription}: Props) {
  const location = useLocation();

  useEffect(() => {
    trackSubscriptionView(organization, subscription, 'receipts');
  }, [organization, subscription]);

  const {
    data: payments,
    isPending,
    isError,
    getResponseHeader,
  } = useApiQuery<InvoiceBase[]>(
    [
      `/customers/${organization.slug}/invoices/`,
      {
        query: {cursor: location.query.cursor},
      },
    ],
    {
      staleTime: 0,
    }
  );

  const paymentsPageLinks = getResponseHeader?.('Link');

  if (isPending) {
    return (
      <Fragment>
        <SubscriptionHeader subscription={subscription} organization={organization} />
        <LoadingIndicator />
      </Fragment>
    );
  }

  if (isError) {
    return <LoadingError />;
  }

  const hasBillingPerms = organization.access?.includes('org:billing');
  if (!hasBillingPerms) {
    return <ContactBillingMembers />;
  }

  return (
    <Fragment>
      <SubscriptionHeader organization={organization} subscription={subscription} />
      <div className="ref-payment-list" data-test-id="payment-list">
        <PanelTable
          headers={[
            t('Date'),
            <RightAlign key="amount">{t('Amount')}</RightAlign>,
            <RightAlign key="status">{t('Status')}</RightAlign>,
            <CenterAlign key="status">{t('Receipt')}</CenterAlign>,
          ]}
        >
          {payments.map((payment, i) => {
            const url = `/settings/${organization.slug}/billing/receipts/${payment.id}/`;
            return (
              <Fragment key={i}>
                <Column>
                  <Link to={url}>
                    <DateTime date={payment.dateCreated} dateOnly year />
                  </Link>
                </Column>
                <RightAlign>
                  <div>{formatCurrency(payment.amountBilled ?? 0)}</div>
                  {!!payment.amountRefunded && (
                    <small>
                      {tct('[amount] refunded', {
                        amount: formatCurrency(payment.amountRefunded),
                      })}
                    </small>
                  )}
                </RightAlign>
                <Status>
                  {payment.isPaid
                    ? InvoiceStatus.PAID
                    : payment.isClosed
                      ? InvoiceStatus.CLOSED
                      : InvoiceStatus.AWAITING_PAYMENT}
                </Status>
                <CenterAlign>
                  <div>
                    <LinkButton
                      size="sm"
                      icon={<IconDownload size="sm" />}
                      href={payment.receipt.url}
                      aria-label={t('Download')}
                    />
                  </div>
                </CenterAlign>
              </Fragment>
            );
          })}
        </PanelTable>

        {paymentsPageLinks && <Pagination pageLinks={paymentsPageLinks} />}
      </div>
    </Fragment>
  );
}

const Column = styled('div')`
  display: grid;
  align-items: center;
`;

const RightAlign = styled(Column)`
  text-align: right;
`;

const CenterAlign = styled(Column)`
  text-align: center;
`;

const Status = styled(RightAlign)`
  text-transform: capitalize;
`;

export default withOrganization(withSubscription(PaymentHistory));
