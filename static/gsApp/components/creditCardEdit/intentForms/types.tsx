import type {Stripe, StripeElements} from '@stripe/stripe-js';

import type {StripeCreditCardFormProps} from 'getsentry/components/creditCardEdit/stripeForm';
import type {PaymentCreateResponse, PaymentSetupCreateResponse} from 'getsentry/types';

export interface StripeIntentFormProps
  extends Omit<StripeCreditCardFormProps, 'amount'> {}

export interface InnerIntentFormProps extends StripeIntentFormProps {
  handleSubmit: ({
    stripe,
    elements,
  }: {
    elements: StripeElements | null;
    stripe: Stripe | null;
  }) => void;
  isSubmitting: boolean;
  onError: (error: string) => void;
  busyButtonText?: string;
  intentData?: PaymentSetupCreateResponse | PaymentCreateResponse;
}
