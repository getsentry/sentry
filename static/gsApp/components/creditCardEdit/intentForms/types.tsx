import type {Stripe, StripeElements} from '@stripe/stripe-js';

import type {CreditCardFormProps} from 'getsentry/components/creditCardEdit/form';
import type {PaymentCreateResponse, PaymentSetupCreateResponse} from 'getsentry/types';

export interface IntentFormProps extends Omit<CreditCardFormProps, 'amount'> {}

export interface InnerIntentFormProps extends IntentFormProps {
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
  errorMessage?: string;
  intentData?: PaymentSetupCreateResponse | PaymentCreateResponse;
}
