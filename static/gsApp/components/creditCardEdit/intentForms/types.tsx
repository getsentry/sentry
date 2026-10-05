import type {Stripe, StripeElements} from '@stripe/stripe-js';

import type {CreditCardFormProps} from 'getsentry/components/creditCardEdit/form';

export interface IntentFormProps extends Omit<CreditCardFormProps, 'amount'> {}

export interface InnerIntentFormProps extends IntentFormProps {
  handleSubmit: ({
    stripe,
    elements,
  }: {
    elements: StripeElements | null;
    stripe: Stripe | null;
  }) => void | Promise<void>;
  isSubmitting: boolean;
  onError: (error: string) => void;
  errorMessage?: string;
}
