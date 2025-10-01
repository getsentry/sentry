import StripePaymentIntentForm from 'getsentry/components/creditCardEdit/intentForms/paymentIntentForm';
import StripeSetupIntentForm from 'getsentry/components/creditCardEdit/intentForms/setupIntentForm';
import type {StripeCreditCardSetupProps} from 'getsentry/components/creditCardEdit/stripeSetup';
import StripeWrapper from 'getsentry/components/stripeWrapper';

export interface StripeCreditCardFormProps extends StripeCreditCardSetupProps {
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

export default StripeCreditCardForm;
