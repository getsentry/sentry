import {useState} from 'react';
import {PaymentElement, useElements, useStripe} from '@stripe/react-stripe-js';
import type {
  PaymentIntentResult,
  PaymentMethod,
  SetupIntentResult,
  StripePaymentElementChangeEvent,
} from '@stripe/stripe-js';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import Form from 'sentry/components/forms/form';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';

import type {StripeCreditCardSetupProps} from 'getsentry/components/stripeCreditCardSetup';
import StripeWrapper from 'getsentry/components/stripeWrapper';
import {usePaymentIntentData, useSetupIntentData} from 'getsentry/hooks/useIntentData';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {
  FTCConsentLocation,
  PaymentCreateResponse,
  PaymentSetupCreateResponse,
  Subscription,
} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

interface StripeCreditCardFormProps extends StripeCreditCardSetupProps {
  cardMode: 'setup' | 'payment';
  intentDataEndpoint: string;
  amount?: number;
}

interface StripeIntentFormProps extends StripeCreditCardSetupProps {
  /**
   * If the form is being used for setup or payment intent.
   */
  cardMode: 'setup' | 'payment';
  /**
   * The endpoint to get the intent data.
   */
  intentDataEndpoint: string;
}

interface IntentFormProps
  extends Omit<StripeCreditCardFormProps, 'amount' | 'intentDataEndpoint'> {
  onError: (error: string) => void;
  intentData?: PaymentSetupCreateResponse | PaymentCreateResponse;
}

function StripeCreditCardForm(props: StripeCreditCardFormProps) {
  return (
    <StripeWrapper paymentElementMode={props.cardMode} amount={props.amount}>
      {props.cardMode === 'setup' ? (
        <StripeSetupIntentForm {...props} />
      ) : (
        <StripePaymentIntentForm {...props} />
      )}
    </StripeWrapper>
  );
}

function StripeSetupIntentForm({
  onSuccess,
  budgetModeText,
  buttonText,
  location,
  referrer,
  organization,
  cardMode,
  intentDataEndpoint,
}: StripeIntentFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const {intentData, isLoading, isError, error} = useSetupIntentData({
    endpoint: intentDataEndpoint,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    setErrorMessage(error);
  }

  return (
    <Flex direction="column" gap="xl">
      <Alert type="error">{errorMessage}</Alert>
      <IntentForm
        cardMode={cardMode}
        onSuccess={onSuccess}
        budgetModeText={budgetModeText}
        buttonText={buttonText}
        location={location}
        referrer={referrer}
        organization={organization}
        intentData={intentData}
        onError={setErrorMessage}
      />
    </Flex>
  );
}

function StripePaymentIntentForm({
  onSuccess,
  budgetModeText,
  buttonText,
  location,
  referrer,
  organization,
  cardMode,
  intentDataEndpoint,
}: StripeIntentFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const {intentData, isLoading, isError, error} = usePaymentIntentData({
    endpoint: intentDataEndpoint,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    setErrorMessage(error);
  }

  return (
    <Flex direction="column" gap="xl">
      {isError && <Alert type="error">{errorMessage}</Alert>}
      <IntentForm
        cardMode={cardMode}
        onSuccess={onSuccess}
        budgetModeText={budgetModeText}
        buttonText={buttonText}
        location={location}
        referrer={referrer}
        organization={organization}
        intentData={intentData}
        onError={setErrorMessage}
      />
    </Flex>
  );
}

function IntentForm({
  cardMode,
  onSuccess,
  budgetModeText,
  buttonText,
  location,
  referrer,
  organization,
  onError,
  intentData,
}: IntentFormProps) {
  const [loading, setLoading] = useState(false);
  const elements = useElements();
  const stripe = useStripe();
  const [submitDisabled, setSubmitDisabled] = useState(false);

  const {mutateAsync: updateSubscription} = useMutation({
    mutationFn: ({
      paymentMethod,
      ftcConsentLocation,
    }: {
      paymentMethod: string | PaymentMethod | null;
      ftcConsentLocation?: FTCConsentLocation;
    }) =>
      fetchMutation<Subscription>({
        method: 'PUT',
        url: `/customers/${organization.slug}/`,
        data: {
          paymentMethod,
          ftcConsentLocation,
        },
      }),
    onMutate: () => {
      setLoading(true);
    },
    onSuccess: (data: Subscription) => {
      addSuccessMessage(t('Updated payment method.'));
      setLoading(false);
      SubscriptionStore.set(organization.slug, data);
      onSuccess?.();
    },
    onError: error => {
      onError(error.message);
      setSubmitDisabled(true);
      setLoading(false);
    },
  });

  if (loading) {
    return <LoadingIndicator />;
  }

  const handleSubmit = () => {
    if (!stripe || !elements || !intentData) {
      onError(t('Cannot complete your payment at this time, please try again later.'));
      return;
    }

    elements.submit();
    switch (cardMode) {
      case 'payment':
        stripe
          .confirmPayment({
            elements,
            clientSecret: intentData.clientSecret,
            redirect: 'if_required',
          })
          .then((result: PaymentIntentResult) => {
            if (result.error) {
              onError(result.error.message ?? t('Payment failed.'));
              return;
            }
            // TODO: make sure this is the correct event
            trackGetsentryAnalytics('billing_failure.paid_now', {
              organization,
              referrer: decodeScalar(referrer),
            });
            addSuccessMessage(t('Payment sent successfully.'));
            onSuccess?.();
          });
        break;
      default:
        stripe
          .confirmSetup({
            elements,
            clientSecret: intentData.clientSecret,
            redirect: 'if_required',
          })
          .then((result: SetupIntentResult) => {
            if (result.error) {
              onError(result.error.message ?? t('Setup failed.'));
              return;
            }
            updateSubscription({
              paymentMethod: result.setupIntent.payment_method,
              ftcConsentLocation: location,
            });
          });

        break;
    }
  };

  const handleFormChange = (formData: StripePaymentElementChangeEvent) => {
    if (formData.complete) {
      setSubmitDisabled(false);
    } else {
      setSubmitDisabled(true);
    }
  };

  return (
    <Form
      onSubmit={handleSubmit}
      submitDisabled={submitDisabled}
      submitLabel={buttonText}
    >
      <Flex direction="column" gap="xl">
        <PaymentElement
          onChange={handleFormChange}
          options={{
            // fields: {billingDetails: 'never'},
            terms: {card: 'never'}, // we display the terms ourselves
            wallets: {applePay: 'never', googlePay: 'never'},
          }}
          onReady={() => setLoading(false)}
        />
        <Flex direction="column" gap="sm">
          <small>
            {tct('Payments are processed securely through [stripe:Stripe].', {
              stripe: <ExternalLink href="https://stripe.com/" />,
            })}
          </small>
          {/* location is 0 on the checkout page which is why this isn't location && */}
          {location !== null && location !== undefined && (
            <Text size="xs" variant="muted">
              {tct(
                'By clicking [buttonText], you authorize Sentry to automatically charge you recurring subscription fees and applicable [budgetModeText] fees. Recurring charges occur at the start of your selected billing cycle for subscription fees and monthly for [budgetModeText] fees. You may cancel your subscription at any time [here:here].',
                {
                  buttonText: <b>{buttonText}</b>,
                  budgetModeText,
                  here: (
                    <ExternalLink href="https://sentry.io/settings/billing/cancel/" />
                  ),
                }
              )}
            </Text>
          )}
        </Flex>
      </Flex>
    </Form>
  );
}

export default StripeCreditCardForm;
