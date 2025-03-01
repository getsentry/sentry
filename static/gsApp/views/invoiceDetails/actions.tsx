import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button, LinkButton} from 'sentry/components/button';
import {Input} from 'sentry/components/core/input';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

import {openInvoicePaymentModal} from 'getsentry/actionCreators/modal';
import type {Invoice} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type Props = {
  invoice: Invoice;
  organization: Organization;
  reloadInvoice: () => void;
};

function InvoiceDetailsActions({organization, invoice, reloadInvoice}: Props) {
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

  function handlePayNow(event: React.MouseEvent<Element>) {
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
    <Fragment>
      <ActionContainer className="no-print">
        <EmailForm method="post" action="" onSubmit={handleSend}>
          {invoice.isPaid && (
            <Fragment>
              <Input type="email" name="email" placeholder="you@example.com" />
              <StyledButton type="submit" priority="primary">
                {t('Email Receipt')}
              </StyledButton>
            </Fragment>
          )}
          {showPayNowButton && (
            <StyledButton
              priority="primary"
              onClick={handlePayNow}
              data-test-id="pay-now"
            >
              {t('Pay Now')}
            </StyledButton>
          )}
          <StyledLinkButton href={invoice.receipt.url}>{t('Save PDF')}</StyledLinkButton>
        </EmailForm>
      </ActionContainer>
    </Fragment>
  );
}

export default InvoiceDetailsActions;

const ActionContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
`;

const EmailForm = styled('form')`
  display: grid;
  grid-auto-flow: column;
  align-items: start;
  gap: ${space(1)};

  /* override selector in PanelBody > form */
  && {
    margin: 0;
  }

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-auto-flow: row;
    width: 100%;
  }
`;

const StyledButton = styled(Button)`
  flex-shrink: 0;
`;

const StyledLinkButton = styled(LinkButton)`
  flex-shrink: 0;
`;
