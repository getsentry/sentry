import {useEffect, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {
  CardElement,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import {
  type PaymentIntentResult,
  type PaymentMethod,
  type SetupIntentResult,
  type Stripe,
  type StripeCardElement,
  type StripePaymentElementChangeEvent,
} from '@stripe/stripe-js';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Input} from 'sentry/components/core/input';
import {Container, Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Form from 'sentry/components/forms/form';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {NODE_ENV} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import StripeWrapper from 'getsentry/components/stripeWrapper';
import {
  FTCConsentLocation,
  type PaymentCreateResponse,
  type PaymentSetupCreateResponse,
} from 'getsentry/types';
import {hasStripeComponentsFeature} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

export type SubmitData = {
  /**
   * The card element used to collect the credit card.
   */
  cardElement: StripeCardElement;
  /**
   * To be called when the stripe operation is complete.
   * When called it re-enables the form buttons.
   */
  onComplete: () => void;
  /**
   * Stripe client instance used.
   */
  stripe: Stripe;
  /**
   * Validation errors from fields contained in this form.
   * If not-empty submission should not continue.
   */
  validationErrors: string[];
};

type Props = {
  /**
   * If the form is being used for setup or payment intent.
   */
  cardMode: 'setup' | 'payment';
  /**
   * Handle the card form submission.
   */
  onSubmit: (data: SubmitData) => void;
  /**
   * budget mode text for fine print, if any.
   */
  budgetModeText?: string;
  /**
   * Text for the submit button.
   */
  buttonText?: string;
  /**
   * Text for the cancel button.
   */
  cancelButtonText?: string;
  /**
   * Classname/styled component wrapper for the form.
   */
  className?: string;
  /**
   * Error message to show.
   */
  error?: string;
  /**
   * If the error message has an action that can be retried, this callback
   * will be invoked by the 'retry' button shown in the error message.
   */
  errorRetry?: () => void;
  /**
   * Classname for the footer buttons.
   */
  footerClassName?: string;
  /**
   * Location of form, if any.
   */
  location?: FTCConsentLocation;
  /**
   * Handler for cancellation.
   */
  onCancel?: () => void;
  /**
   * The URL referrer, if any.
   */
  referrer?: string;
};

/**
 * Standalone credit card form that requires onSubmit to be handled
 * by the parent. This allows us to reuse the same form for both paymentintent, setupintent
 * and classic card flows.
 */
function CreditCardForm(props: Props) {
  const organization = useOrganization();
  const shouldUseStripeComponents = hasStripeComponentsFeature(organization);

  return (
    <StripeWrapper mode={props.cardMode}>
      {shouldUseStripeComponents ? (
        <StripeCreditCardFormInner {...props} organization={organization} />
      ) : (
        <CreditCardFormInner {...props} />
      )}
    </StripeWrapper>
  );
}

function StripeCreditCardFormInner({
  buttonText,
  budgetModeText,
  location,
  cardMode,
  organization,
  endpoint,
}: Props & {organization: Organization; endpoint?: string}) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const elements = useElements();
  const stripe = useStripe();
  const [errorMessage, setErrorMessage] = useState<React.ReactNode | undefined>(
    undefined
  );
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const currentLocation = useLocation();
  const [intentData, setIntentData] = useState<
    PaymentSetupCreateResponse | PaymentCreateResponse | undefined
  >(undefined);

  const intentDataEndpoint =
    endpoint ?? `/organizations/${organization.slug}/payments/setup/`;
  const {mutate: loadIntentData} = useMutation<
    PaymentSetupCreateResponse | PaymentCreateResponse
  >({
    mutationFn: () =>
      fetchMutation({
        method: 'POST',
        url: intentDataEndpoint,
      }),
    onSuccess: data => {
      setIntentData(data);
      setLoading(false);
    },
    onError: error => {
      setErrorMessage(error.message);
      setSubmitDisabled(true);
      setLoading(false);
    },
  });

  const {mutateAsync: updateSubscription} = useMutation({
    mutationFn: ({
      paymentMethod,
      ftcConsentLocation,
    }: {
      paymentMethod: string | PaymentMethod | null;
      ftcConsentLocation?: FTCConsentLocation;
    }) =>
      fetchMutation({
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
    onSuccess: () => {
      addSuccessMessage(t('Updated payment method.'));
      setLoading(false);
    },
    onError: error => {
      setErrorMessage(error.message);
      setSubmitDisabled(true);
      setLoading(false);
    },
  });

  useEffect(() => {
    setLoading(true);
    loadIntentData();
  }, [loadIntentData]);

  if (loading) {
    return <LoadingIndicator />;
  }

  const handleSubmit = () => {
    if (busy) {
      return;
    }
    setBusy(true);
    if (!intentData || !stripe || !elements) {
      setErrorMessage(
        t('Cannot complete your payment at this time, please try again later.')
      );
      setBusy(false);
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
              setErrorMessage(result.error.message);
              return;
            }
            // TODO: make sure this is the correct event
            trackGetsentryAnalytics('billing_failure.paid_now', {
              organization,
              referrer: decodeScalar(currentLocation?.query?.referrer),
            });
            addSuccessMessage(t('Payment sent successfully.'));
            // TODO: call onSuccess?
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
              setErrorMessage(result.error.message);
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
    <Form onSubmit={handleSubmit} submitDisabled={submitDisabled}>
      <Flex direction="column" gap="xl">
        {errorMessage && <Alert type="error">{errorMessage}</Alert>}
        <PaymentElement
          onChange={handleFormChange}
          options={{
            // fields: {billingDetails: 'never'},
            terms: {card: 'never'}, // we display the terms ourselves
            wallets: {applePay: 'never', googlePay: 'never'},
          }}
          onReady={() => setLoading(false)}
        />
        <Container>
          <small>
            {tct('Payments are processed securely through [stripe:Stripe].', {
              stripe: <ExternalLink href="https://stripe.com/" />,
            })}
          </small>
          {/* location is 0 on the checkout page which is why this isn't location && */}
          {location !== null && location !== undefined && (
            <FinePrint>
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
            </FinePrint>
          )}
        </Container>
      </Flex>
    </Form>
  );
}

function CreditCardFormInner({
  className,
  error,
  errorRetry,
  onCancel,
  onSubmit,
  buttonText = t('Save Changes'),
  cancelButtonText = t('Cancel'),
  footerClassName = 'form-actions',
  referrer,
  location,
  budgetModeText,
}: Props) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const stripe = useStripe();
  const elements = useElements();

  // XXX: Default loading to false when in test mode. The stripe elements will
  // never load, but we still want to test some functionality of this modal.
  const defaultLoadState = NODE_ENV !== 'test';

  const [loading, setLoading] = useState(defaultLoadState);

  const stripeElementStyles = {
    base: {
      backgroundColor: theme.isChonk ? theme.tokens.background.primary : theme.background,
      color: theme.isChonk ? theme.tokens.content.primary : theme.textColor,
      fontFamily: theme.text.family,
      fontWeight: 400,
      fontSize: theme.fontSize.lg,
      '::placeholder': {
        color: theme.isChonk ? theme.tokens.content.muted : theme.gray300,
      },
      iconColor: theme.isChonk ? theme.tokens.content.primary : theme.gray300,
    },
    invalid: {
      color: theme.isChonk ? theme.tokens.content.danger : theme.red300,
      iconColor: theme.isChonk ? theme.tokens.content.danger : theme.red300,
    },
  };

  function onComplete() {
    setBusy(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);

    const validationErrors: string[] = [];
    const cardElement = elements?.getElement(CardElement);

    if (!stripe || !cardElement) {
      setBusy(false);
      return;
    }
    onSubmit({stripe, cardElement, onComplete, validationErrors});
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault();
    if (busy) {
      return;
    }
    onCancel?.();
  }

  function handleErrorRetry(event: React.MouseEvent) {
    event.preventDefault();
    errorRetry?.();
  }

  const disabled = busy || loading || !stripe || !elements;

  return (
    <form
      className={className}
      action="."
      method="POST"
      id="payment-form"
      onSubmit={handleSubmit}
    >
      {error && (
        <Alert.Container>
          <Alert type="error" showIcon={false}>
            <AlertContent>
              {error}
              {errorRetry && (
                <Button size="sm" onClick={handleErrorRetry}>
                  {t('Retry')}
                </Button>
              )}
            </AlertContent>
          </Alert>
        </Alert.Container>
      )}
      {loading && <LoadingIndicator />}
      {referrer?.includes('billing-failure') && (
        <Alert.Container>
          <Alert type="warning" showIcon={false}>
            {t('Your credit card will be charged upon update.')}
          </Alert>
        </Alert.Container>
      )}
      <CreditCardInfoWrapper isLoading={loading}>
        <StyledField
          stacked
          flexibleControlStateSize
          inline={false}
          label={t('Card Details')}
        >
          <FormControl>
            <CardElement
              options={{
                style: stripeElementStyles,
                ...(theme.isChonk ? undefined : {hidePostalCode: false}),
              }}
              onReady={() => setLoading(false)}
            />
          </FormControl>
        </StyledField>

        <Info>
          <small>
            {tct('Payments are processed securely through [stripe:Stripe].', {
              stripe: <ExternalLink href="https://stripe.com/" />,
            })}
          </small>
          {/* location is 0 on the checkout page which is why this isn't location && */}
          {location !== null && location !== undefined && (
            <FinePrint>
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
            </FinePrint>
          )}
        </Info>

        <div className={footerClassName}>
          <StyledButtonBar>
            {onCancel && (
              <Button
                data-test-id="cancel"
                priority="default"
                disabled={disabled}
                onClick={handleCancel}
              >
                {cancelButtonText}
              </Button>
            )}
            <Button
              data-test-id="submit"
              type="submit"
              priority="primary"
              disabled={disabled}
              onClick={handleSubmit}
            >
              {buttonText}
            </Button>
          </StyledButtonBar>
        </div>
      </CreditCardInfoWrapper>
    </form>
  );
}

const FormControl = styled(Input.withComponent('div'))`
  /* Allow stripe form element to fill whatever height it needs to based
   * on the config that we are providing it with. */
  height: ${p => (p.theme.isChonk ? 'auto' : undefined)};
`;

const fieldCss = css`
  padding-right: 0;
  padding-left: 0;
`;

const StyledField = styled(FieldGroup)`
  ${fieldCss};
  padding-top: 0;
  height: auto;
`;

const Info = styled('div')`
  ${fieldCss};
  margin-bottom: ${space(3)};
  margin-top: ${space(1)};
`;

const FinePrint = styled('div')`
  margin-top: ${space(1)};
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => (p.theme.isChonk ? p.theme.tokens.content.muted : p.theme.gray300)};
`;

const CreditCardInfoWrapper = styled('div')<{isLoading?: boolean}>`
  ${p => p.isLoading && 'display: none'};
`;

const StyledButtonBar = styled(ButtonBar)`
  max-width: fit-content;
`;

const AlertContent = styled('span')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export default CreditCardForm;
