import {PaymentIntentForm} from 'getsentry/components/creditCardEdit/intentForms/paymentIntentForm';
import {SetupIntentForm} from 'getsentry/components/creditCardEdit/intentForms/setupIntentForm';
import type {IntentFormProps} from 'getsentry/components/creditCardEdit/intentForms/types';
import {StripeWrapper} from 'getsentry/components/stripeWrapper';

export type CreditCardFormProps = IntentFormProps & {
  amount?: number;
};

export function CreditCardForm(props: CreditCardFormProps) {
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
