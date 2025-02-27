import {Fragment, useCallback, useEffect, useState} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

import type {SubmitData} from 'getsentry/components/creditCardForm';
import CreditCardForm from 'getsentry/components/creditCardForm';
import type {Invoice, PaymentCreateResponse} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

import {displayPriceWithCents} from '../amCheckout/utils';

type Props = Pick<ModalRenderProps, 'Header' | 'Body' | 'closeModal'> & {
  invoice: Invoice;
  organization: Organization;
  reloadInvoice: () => void;
};

function InvoiceDetailsPaymentForm({
  Header,
  Body,
  closeModal,
  organization,
  invoice,
  reloadInvoice,
}: Props) {
  const api = useApi();
  const [validationError, setValidationError] = useState<string | undefined>();
  const [intentError, setIntentError] = useState<string | undefined>(undefined);
  const [intentData, setIntentData] = useState<PaymentCreateResponse | undefined>(
    undefined
  );
  const location = useLocation();

  const loadData = useCallback(async () => {
    setIntentError(undefined);
    try {
      const payload: PaymentCreateResponse = await api.requestPromise(
        `/organizations/${invoice.customer.slug}/payments/${invoice.id}/new/`
      );
      setIntentData(payload);
    } catch (e) {
      setIntentError(t('Unable to initialize payment, please try again later.'));
    }
  }, [api, invoice.customer.slug, invoice.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleSubmit({cardElement, stripe, validationErrors, onComplete}: SubmitData) {
    if (validationErrors.length) {
      onComplete();
      setValidationError(validationErrors[0]);
      return;
    }
    if (!intentData) {
      setValidationError(
        t('Cannot complete your payment at this time, please try again later.')
      );
      return;
    }

    stripe
      .confirmCardPayment(intentData.clientSecret, {
        payment_method: {card: cardElement},
        return_url: intentData.returnUrl,
      })
      .then((result: stripe.PaymentIntentResponse) => {
        if (result.error) {
          setIntentError(result.error.message);
          return;
        }
        trackGetsentryAnalytics('billing_failure.paid_now', {
          organization,
          referrer: decodeScalar(location?.query?.referrer),
        });
        addSuccessMessage(t('Payment sent successfully.'));
        reloadInvoice();
        closeModal();
      });
  }
  const error = validationError || intentError;
  const errorRetry = intentError ? () => loadData() : undefined;

  return (
    <Fragment>
      <Header>{t('Pay Invoice')}</Header>
      <Body>
        <p>
          {tct('Complete payment for [amount] USD', {
            amount: displayPriceWithCents({cents: invoice.amountBilled ?? 0}),
          })}
        </p>
        <CreditCardForm
          buttonText={t('Pay Now')}
          error={error}
          errorRetry={errorRetry}
          footerClassName="modal-footer"
          onCancel={() => closeModal()}
          onSubmit={handleSubmit}
        />
      </Body>
    </Fragment>
  );
}

export default InvoiceDetailsPaymentForm;
