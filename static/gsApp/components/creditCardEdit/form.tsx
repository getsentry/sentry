import type {Organization} from 'sentry/types/organization';

import type {SubmitData} from 'getsentry/components/creditCardEdit/legacyForm';
import LegacyCreditCardForm from 'getsentry/components/creditCardEdit/legacyForm';
import StripeCreditCardForm from 'getsentry/components/creditCardEdit/stripeForm';
import type {FTCConsentLocation, Subscription} from 'getsentry/types';
import {hasStripeComponentsFeature} from 'getsentry/utils/billing';

interface CreditCardFormProps {
  /**
   * budget term to use for fine print.
   */
  budgetTerm: string;
  /**
   * If the Stripe form is being used for setup or payment intent.
   */
  cardMode: 'setup' | 'payment';
  /**
   * The endpoint to get the intent data.
   */
  intentDataEndpoint: string;
  /**
   * Handler for submission for the legacy form.
   */
  onSubmitLegacy: (data: SubmitData) => void;
  /**
   * The organization for the customer using the form
   */
  organization: Organization;
  /**
   * The amount to charge.
   */
  amount?: number;
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
   * Handler for submission for the Stripe form.
   */
  onSuccess?: () => void;
  /**
   * Handler for submission for the Stripe form called with new subscription state.
   */
  onSuccessWithSubscription?: (subscription: Subscription) => void;
  /**
   * The URL referrer, if any.
   */
  referrer?: string;
}

function CreditCardForm(props: CreditCardFormProps) {
  const {organization} = props;
  const shouldUseStripe = hasStripeComponentsFeature(organization);

  if (shouldUseStripe) {
    return <StripeCreditCardForm {...props} />;
  }

  return <LegacyCreditCardForm {...props} onSubmit={props.onSubmitLegacy} />;
}

export default CreditCardForm;
