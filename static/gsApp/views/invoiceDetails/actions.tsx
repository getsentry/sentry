import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

import {openInvoicePaymentModal} from 'getsentry/actionCreators/modal';
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
      // Open "Pay Now" modal and track clicks from payment failure emails
      if (
        // There are multiple billing failure referrals and each should have analytics tracking
        queryReferrer.includes('billing-failure') &&
        !invoice.isPaid &&
        !invoice.isClosed
      ) {
        openInvoicePaymentModal({invoice, organization, reloadInvoice});
        trackGetsentryAnalytics('billing_failure.button_clicked', {
          organization,
          referrer: queryReferrer,
        });
      }
    }
  }, [invoice, organization, reloadInvoice, location.query.referrer]);

  const isSelfServePartner =
    'isSelfServePartner' in invoice.customer && invoice.customer.isSelfServePartner;
  const showPayNowButton = !invoice.isPaid && !invoice.isClosed && !isSelfServePartner;

  return (
    <Flex
      borderTop="primary"
      padding="xl 2xl"
      align="center"
      justify="between"
      className="no-print"
    >
      <EmailForm method="post" action="" onSubmit={handleSend}>
        {invoice.isPaid && (
          <Fragment>
            <Input type="email" name="email" placeholder="you@example.com" size="sm" />
            <Button type="submit" size="sm" variant="secondary">
              {t('Email Receipt')}
            </Button>
          </Fragment>
        )}
        {showPayNowButton && (
          <Button
            size="sm"
            variant="secondary"
            onClick={handlePayNow}
            data-test-id="pay-now"
          >
            {t('Pay Now')}
          </Button>
        )}
        <LinkButton href={invoice.receipt.url} size="sm" variant="secondary">
          {t('Save PDF')}
        </LinkButton>
      </EmailForm>
      <Text size="sm" variant="secondary">
        {t('Generated')} <DateTime date={invoice.dateCreated} />.
      </Text>
    </Flex>
  );
}

const EmailForm = styled('form')`
  display: grid;
  grid-auto-flow: column;
  align-items: start;
  gap: ${p => p.theme.space.md};

  /* override selector in PanelBody > form */
  && {
    margin: 0;
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-auto-flow: row;
    width: 100%;
  }
`;
