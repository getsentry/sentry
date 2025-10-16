import {useEffect, useState} from 'react';
import {loadStripe, type Stripe} from '@stripe/stripe-js';

import ConfigStore from 'sentry/stores/configStore';

/**
 * Custom hook to load and manage a Stripe instance
 * Encapsulates the loading pattern used across checkout components
 */
export function useStripeInstance() {
  const [stripe, setStripe] = useState<Stripe | null>(null);

  useEffect(() => {
    if (!stripe) {
      loadStripe(ConfigStore.get('getsentry.stripePublishKey')!).then(setStripe);
    }
  }, [stripe]);

  return stripe;
}
