import {useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {CardElement, useElements, useStripe} from '@stripe/react-stripe-js';
import {type Stripe, type StripeCardElement} from '@stripe/stripe-js';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Input} from 'sentry/components/core/input';
import {ExternalLink} from 'sentry/components/core/link';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {NODE_ENV} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import StripeWrapper from 'getsentry/components/stripeWrapper';
import {FTCConsentLocation} from 'getsentry/types';

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
   * budget term to use for fine print.
   */
  budgetTerm: string;
  /**
   * Handle the card form submission.
   */
  onSubmit: (data: SubmitData) => void;
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
 *
 * @deprecated Use CreditCardForm for flag-based rendering or StripeCreditCardForm directly instead.
 */
function LegacyCreditCardForm(props: Props) {
  return (
    <StripeWrapper>
      <CreditCardFormInner {...props} />
    </StripeWrapper>
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
  budgetTerm,
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
      backgroundColor: theme.tokens.background.primary,
      color: theme.tokens.content.primary,
      fontFamily: theme.text.family,
      fontWeight: 400,
      fontSize: theme.fontSize.lg,
      '::placeholder': {
        color: theme.tokens.content.muted,
      },
      iconColor: theme.tokens.content.primary,
    },
    invalid: {
      color: theme.tokens.content.danger,
      iconColor: theme.tokens.content.danger,
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
          <Alert type="danger" showIcon={false}>
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
                'By clicking [buttonText], you authorize Sentry to automatically charge you recurring subscription fees and applicable [budgetTerm] fees. Recurring charges occur at the start of your selected billing cycle for subscription fees and monthly for [budgetTerm] fees. You may cancel your subscription at any time [here:here].',
                {
                  buttonText: <b>{buttonText}</b>,
                  budgetTerm,
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
  height: auto;
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
  color: ${p => p.theme.tokens.content.muted};
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

export default LegacyCreditCardForm;
