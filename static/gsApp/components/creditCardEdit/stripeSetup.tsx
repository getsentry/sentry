import type {Organization} from 'sentry/types/organization';

import StripeCreditCardForm from 'getsentry/components/creditCardEdit/stripeForm';
import type {FTCConsentLocation, Subscription} from 'getsentry/types';

export interface StripeCreditCardSetupProps {
  /**
   * budget term to use for fine print.
   */
  budgetTerm: string;
  /**
   * The organization associated with the form
   */
  organization: Organization;
  /**
   * Text for the submit button.
   */
  buttonText?: string;
  /**
   * Location of form, if any.
   */
  location?: FTCConsentLocation;

  /**
   * Handler for cancellation.
   */
  onCancel?: () => void;

  /**
   * Handler for success.
   */
  onSuccess?: () => void;
  /**
   * Handler for success called with new subscription state.
   */
  onSuccessWithSubscription?: (subscription: Subscription) => void;
  /**
   * The URL referrer, if any.
   */
  referrer?: string;
}

function StripeCreditCardSetup(props: StripeCreditCardSetupProps) {
  return (
    <StripeCreditCardForm
      cardMode="setup"
      intentDataEndpoint={`/organizations/${props.organization.slug}/payments/setup/`}
      {...props}
    />
  );
}

export default StripeCreditCardSetup;
