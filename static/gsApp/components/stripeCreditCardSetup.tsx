import type {Organization} from 'sentry/types/organization';

import StripeCreditCardForm from 'getsentry/components/stripeCreditCardForm';
import type {FTCConsentLocation} from 'getsentry/types';

export interface StripeCreditCardSetupProps {
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
