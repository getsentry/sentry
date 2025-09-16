import type {Organization} from 'sentry/types/organization';

import StripeCreditCardForm from 'getsentry/components/stripeForms/stripeCreditCardForm';
import type {FTCConsentLocation, Subscription} from 'getsentry/types';

export interface StripeCreditCardSetupProps {
  /**
   * Handler for cancellation.
   */
  onCancel: () => void;
  /**
   * Handler for success.
   */
  onSuccess: () => void;
  /**
   * The organization associated with the form
   */
  organization: Organization;
  /**
   * budget mode text for fine print, if any.
   */
  budgetModeText?: string;

  /**
   * Text for the submit button.
   */
  buttonText?: string;

  /**
   * Location of form, if any.
   */
  location?: FTCConsentLocation;
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
