import {useEffect, useState} from 'react';
import {PaymentElement, useElements, useStripe} from '@stripe/react-stripe-js';
import type {
  PaymentIntentResult,
  PaymentMethod,
  SetupIntentResult,
  Stripe,
  StripeElements,
  StripePaymentElementChangeEvent,
} from '@stripe/stripe-js';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
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
import type {
  FTCConsentLocation,
  PaymentCreateResponse,
  PaymentSetupCreateResponse,
  Subscription,
} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

interface StripeCreditCardFormProps extends StripeCreditCardSetupProps {
  /**
   * If the form is being used for setup or payment intent.
   */
  cardMode: 'setup' | 'payment';
  /**
   * The endpoint to get the intent data.
   */
  intentDataEndpoint: string;
  amount?: number;
}

interface StripeIntentFormProps extends Omit<StripeCreditCardFormProps, 'amount'> {}

interface IntentFormProps extends StripeIntentFormProps {
  handleSubmit: ({
    stripe,
    elements,
  }: {
    elements: StripeElements | null;
    stripe: Stripe | null;
  }) => void;
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

function StripeSetupIntentForm(props: StripeIntentFormProps) {
  const {organization, location, onSuccess, onSuccessWithSubscription} = props;
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {intentData, isLoading, isError, error} = useSetupIntentData({
    endpoint: props.intentDataEndpoint,
  });

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
    onSuccess: (data: Subscription) => {
      addSuccessMessage(t('Updated payment method.'));
      onSuccessWithSubscription?.(data);
      onSuccess();
    },
  });

  useEffect(() => {
    if (isError) {
      setErrorMessage(error);
    }
  }, [isError, error]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const handleSubmit = async ({
    stripe,
    elements,
  }: {
    elements: StripeElements | null;
    stripe: Stripe | null;
  }) => {
    setIsSubmitting(true);
    if (!stripe || !elements || !intentData) {
      setErrorMessage(
        t('Cannot complete your payment at this time, please try again later.')
      );
      setIsSubmitting(false);
      return;
    }

    const stripeResult = await elements.submit();
    if (stripeResult.error) {
      setErrorMessage(stripeResult.error.message ?? t('Setup failed.'));
      setIsSubmitting(false);
      return;
    }

    stripe
      .confirmSetup({
        elements,
        clientSecret: intentData.clientSecret,
        redirect: 'if_required',
      })
      .then((result: SetupIntentResult) => {
        if (result.error) {
          setErrorMessage(result.error.message ?? t('Setup failed.'));
          setIsSubmitting(false);
          return;
        }
        updateSubscription({
          paymentMethod: result.setupIntent.payment_method,
          ftcConsentLocation: location,
        });
      });
  };

  return (
    <Flex direction="column" gap="xl">
      {isError && <Alert type="error">{errorMessage}</Alert>}
      <IntentForm
        {...props}
        buttonText={isSubmitting ? t('Saving Changes...') : props.buttonText}
        intentData={intentData}
        onError={setErrorMessage}
        handleSubmit={handleSubmit}
      />
    </Flex>
  );
}

function StripePaymentIntentForm(props: StripeIntentFormProps) {
  const {organization, referrer, onSuccess} = props;
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {intentData, isLoading, isError, error} = usePaymentIntentData({
    endpoint: props.intentDataEndpoint,
  });

  useEffect(() => {
    if (isError) {
      setErrorMessage(error);
    }
  }, [isError, error]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const handleSubmit = async ({
    stripe,
    elements,
  }: {
    elements: StripeElements | null;
    stripe: Stripe | null;
  }) => {
    setIsSubmitting(true);
    if (!stripe || !elements || !intentData) {
      setErrorMessage(
        t('Cannot complete your payment at this time, please try again later.')
      );
      setIsSubmitting(false);
      return;
    }

    const stripeResult = await elements.submit();
    if (stripeResult.error) {
      setErrorMessage(stripeResult.error.message ?? t('Payment failed.'));
      setIsSubmitting(false);
      return;
    }

    stripe
      .confirmPayment({
        elements,
        clientSecret: intentData.clientSecret,
        redirect: 'if_required',
      })
      .then((result: PaymentIntentResult) => {
        if (result.error) {
          setErrorMessage(result.error.message ?? t('Payment failed.'));
          setIsSubmitting(false);
          return;
        }
        // TODO: make sure this is the correct event
        trackGetsentryAnalytics('billing_failure.paid_now', {
          organization,
          referrer: decodeScalar(referrer),
        });
        addSuccessMessage(t('Payment sent successfully.'));
        onSuccess();
      });
  };

  return (
    <Flex direction="column" gap="xl">
      {isError && <Alert type="error">{errorMessage}</Alert>}
      <IntentForm
        {...props}
        buttonText={isSubmitting ? t('Sending Payment...') : props.buttonText}
        intentData={intentData}
        onError={setErrorMessage}
        handleSubmit={handleSubmit}
      />
    </Flex>
  );
}

function IntentForm({
  onCancel,
  budgetModeText,
  buttonText,
  location,
  handleSubmit,
}: IntentFormProps) {
  const [loading, setLoading] = useState(false);
  const elements = useElements();
  const stripe = useStripe();
  const [submitDisabled, setSubmitDisabled] = useState(false);

  if (loading) {
    return <LoadingIndicator />;
  }

  const handleFormChange = (formData: StripePaymentElementChangeEvent) => {
    if (formData.complete) {
      setSubmitDisabled(false);
    } else {
      setSubmitDisabled(true);
    }
  };

  return (
    <Form
      onSubmit={() => handleSubmit({stripe, elements})}
      submitDisabled={submitDisabled}
      submitLabel={buttonText}
      extraButton={<Button onClick={onCancel}>{t('Cancel')}</Button>}
      footerStyle={{
        display: 'flex',
        justifyContent: 'space-between',
        marginLeft: 0,
      }}
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
