import type {ApiQueryKey} from 'sentry/utils/queryClient';

import PaymentIntentForm from 'getsentry/components/creditCardEdit/intentForms/paymentIntentForm';
import SetupIntentForm from 'getsentry/components/creditCardEdit/intentForms/setupIntentForm';
import type {CreditCardSetupProps} from 'getsentry/components/creditCardEdit/setup';
import StripeWrapper from 'getsentry/components/stripeWrapper';

export interface CreditCardFormProps extends CreditCardSetupProps {
  /**
   * If the form is being used for setup or payment intent.
   */
  cardMode: 'setup' | 'payment';
  /**
   * The endpoint to get the intent data.
   */
  intentDataQueryKey: ApiQueryKey;
  /**
   * The amount to charge the user (for a payment intent).
   */
  amount?: number;
}

export default function CreditCardForm(props: CreditCardFormProps) {
  return (
    <StripeWrapper paymentElementMode={props.cardMode} amount={props.amount}>
      {props.cardMode === 'setup' ? (
        <SetupIntentForm {...props} />
      ) : (
        <PaymentIntentForm {...props} />
      )}
    </StripeWrapper>
  );
}
