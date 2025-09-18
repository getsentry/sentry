import type {Stripe, StripeElements} from '@stripe/stripe-js';

import type {StripeCreditCardSetupProps} from 'getsentry/components/stripeCreditCardSetup';
import type {PaymentCreateResponse, PaymentSetupCreateResponse} from 'getsentry/types';

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
  onError: (error: string) => void;
  intentData?: PaymentSetupCreateResponse | PaymentCreateResponse;
}
