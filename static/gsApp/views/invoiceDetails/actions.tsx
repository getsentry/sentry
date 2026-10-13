import {Fragment, useEffect} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Flex, Grid} from '@sentry/scraps/layout';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

import {openInvoicePaymentModal} from 'getsentry/actionCreators/modal';
import {THREE_DS_REFERRER} from 'getsentry/constants';
import type {Invoice} from 'getsentry/types';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

type Props = {
  invoice: Invoice;
  organization: Organization;
  reloadInvoice: () => void;
};

export function InvoiceDetailsActions({organization, invoice, reloadInvoice}: Props) {
  const api = useApi();
  const location = useLocation();

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    formData.append('op', 'send_receipt');

    const data = {};
    formData.forEach((value, key) => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      data[key] = value;
    });

    try {
      addLoadingMessage(t('Sending Email\u2026'));
      await api.requestPromise(
        `/customers/${invoice.customer.slug}/invoices/${invoice.id}/`,
        {
          method: 'POST',
          data,
        }
      );
      addSuccessMessage(t('Email sent successfully.'));
      form.reset();
    } catch (e) {
      addErrorMessage(t('Could not send email.'));
    }
  }

  function handlePayNow(event: React.MouseEvent) {
    event.preventDefault();
    openInvoicePaymentModal({invoice, organization, reloadInvoice});
  }

  useEffect(() => {
    const queryReferrer = decodeScalar(location?.query?.referrer);
    if (invoice && queryReferrer) {
      const isBillingFailure = queryReferrer.includes('billing-failure');
      const needsAuthentication = queryReferrer === THREE_DS_REFERRER;

      // Open "Pay Now" modal and track clicks from payment failure emails
      if (
        (isBillingFailure || needsAuthentication) &&
        !invoice.isPaid &&
        !invoice.isClosed
      ) {
        openInvoicePaymentModal({invoice, organization, reloadInvoice});
        if (isBillingFailure) {
          trackGetsentryAnalytics('billing_failure.button_clicked', {
            organization,
            referrer: queryReferrer,
          });
        }
      }
    }
  }, [invoice, organization, reloadInvoice, location.query.referrer]);

  const isSelfServePartner =
    'isSelfServePartner' in invoice.customer && invoice.customer.isSelfServePartner;
  const showPayNowButton = !invoice.isPaid && !invoice.isClosed && !isSelfServePartner;

  return (
    <Fragment>
      <Flex justify="end" align="start" className="no-print">
        <Grid
          flow={{zero: 'row', xl: 'column'}}
          align="start"
          gap="md"
          width={{zero: '100%', xl: 'auto'}}
          margin="0"
        >
          {gridProps => (
            <form method="post" action="" onSubmit={handleSend} {...gridProps}>
              {invoice.isPaid && (
                <Fragment>
                  <Input type="email" name="email" placeholder="you@example.com" />
                  <Button type="submit" variant="primary">
                    {t('Email Receipt')}
                  </Button>
                </Fragment>
              )}
              {showPayNowButton && (
                <Button variant="primary" onClick={handlePayNow} data-test-id="pay-now">
                  {t('Pay Now')}
                </Button>
              )}
              <LinkButton href={invoice.receipt.url}>{t('Save PDF')}</LinkButton>
            </form>
          )}
        </Grid>
      </Flex>
    </Fragment>
  );
}
