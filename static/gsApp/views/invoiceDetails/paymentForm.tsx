import {Fragment, useCallback, useEffect, useState} from 'react';
import {type PaymentIntentResult} from '@stripe/stripe-js';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';

import CreditCardForm from 'getsentry/components/creditCardEdit/form';
import type {SubmitData} from 'getsentry/components/creditCardEdit/legacyForm';
import type {Invoice, PaymentCreateResponse} from 'getsentry/types';
import {hasStripeComponentsFeature} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';

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
  const endpoint = `/organizations/${invoice.customer.slug}/payments/${invoice.id}/new/`;
  const hasStripeComponents = hasStripeComponentsFeature(organization);

  const loadData = useCallback(async () => {
    setIntentError(undefined);
    try {
      const payload: PaymentCreateResponse = await api.requestPromise(endpoint);
      setIntentData(payload);
    } catch (e) {
      setIntentError(t('Unable to initialize payment, please try again later.'));
    }
  }, [api, endpoint]);

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
      .then((result: PaymentIntentResult) => {
        if (result.error) {
          setIntentError(result.error.message);
          return;
        }
        trackGetsentryAnalytics('billing_failure.paid_now', {
          organization,
          referrer: decodeScalar(location?.query?.referrer),
          isStripeComponent: hasStripeComponents,
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
      <Header>{t('Pay Bill')}</Header>
      <Body>
        <Flex direction="column" gap="sm">
          <Text as="p">
            {tct('Complete payment for [amount] USD', {
              amount: displayPriceWithCents({cents: invoice.amountBilled ?? 0}),
            })}
          </Text>
          <CreditCardForm
            budgetTerm={
              'planDetails' in invoice.customer
                ? invoice.customer.planDetails.budgetTerm
                : t('pay-as-you-go')
            }
            onCancel={() => closeModal()}
            amount={invoice.amountBilled ?? 0}
            cardMode="payment"
            onSuccess={() => {
              reloadInvoice();
              closeModal();
            }}
            organization={organization}
            intentDataEndpoint={endpoint}
            errorRetry={errorRetry}
            footerClassName="modal-footer"
            onSubmitLegacy={handleSubmit}
            referrer={decodeScalar(location?.query?.referrer)}
            buttonText={t('Pay Now')}
            error={error}
          />
        </Flex>
      </Body>
    </Fragment>
  );
}

export default InvoiceDetailsPaymentForm;
