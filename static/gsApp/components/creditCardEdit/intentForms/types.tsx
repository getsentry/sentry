import type {Stripe, StripeElements} from '@stripe/stripe-js';

import type {CreditCardSetupProps} from 'getsentry/components/creditCardEdit/setup';

export interface SetupIntentFormProps extends CreditCardSetupProps {
  cardMode: 'setup';
  invoiceGuid?: never;
}

export interface PaymentIntentFormProps extends CreditCardSetupProps {
  cardMode: 'payment';
  invoiceGuid: string;
}

export type IntentFormProps = SetupIntentFormProps | PaymentIntentFormProps;

export type InnerIntentFormProps = IntentFormProps & {
  handleSubmit: ({
    stripe,
    elements,
  }: {
    elements: StripeElements | null;
    stripe: Stripe | null;
  }) => void | Promise<void>;
  isSubmitting: boolean;
  errorMessage?: string;
  onError?: (error: string) => void;
};
