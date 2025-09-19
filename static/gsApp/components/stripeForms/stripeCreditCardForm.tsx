import StripePaymentIntentForm from 'getsentry/components/stripeForms/paymentIntentForm';
import StripeSetupIntentForm from 'getsentry/components/stripeForms/setupIntentForm';
import type {StripeCreditCardFormProps} from 'getsentry/components/stripeForms/types';
import StripeWrapper from 'getsentry/components/stripeWrapper';

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
