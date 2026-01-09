import React from 'react';
import {useTheme} from '@emotion/react';
import {Elements} from '@stripe/react-stripe-js';

import {debossedBackground} from 'sentry/components/core/chonk';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

import {useStripeInstance} from 'getsentry/hooks/useStripeInstance';

function StripeWrapper({
  paymentElementMode,
  amount,
  children,
}: {
  children: React.ReactNode;
  amount?: number;
  paymentElementMode?: 'setup' | 'payment';
}) {
  const stripe = useStripeInstance();
  const theme = useTheme();
  const prefersDarkMode = useLegacyStore(ConfigStore).theme === 'dark';

  // NOTE: These need to match what we set in the backend
  // for payment and setup intents
  const modeBasedOptions = paymentElementMode
    ? {
        mode: paymentElementMode,
        setupFutureUsage: 'off_session' as const,
        captureMethod: 'automatic' as const,
        paymentMethodTypes: ['card'],
        amount,
      }
    : {};

  return (
    <Elements
      stripe={stripe}
      options={{
        currency: 'usd',
        loader: 'always',
        appearance: {
          theme: prefersDarkMode ? 'night' : 'stripe',
          variables: {
            colorBackground: theme.tokens.background.primary,
            borderRadius: theme.radius.md,
            colorText: theme.tokens.content.primary,
            colorDanger: theme.tokens.content.danger,
            colorSuccess: theme.tokens.content.success,
            colorWarning: theme.tokens.content.warning,
            iconColor: theme.tokens.content.primary,
          },
          rules: {
            '.Input': {
              fontSize: theme.fontSize.md,
              boxShadow: `0px 2px 0px 0px ${theme.tokens.border.primary} inset`,
              backgroundColor: debossedBackground(theme).backgroundColor,
              padding: `${theme.space.lg} ${theme.space.xl}`,
            },
            '.Label': {
              fontSize: theme.fontSize.sm,
              color: theme.tokens.content.secondary,
            },
          },
        },
        ...modeBasedOptions,
      }}
    >
      {children}
    </Elements>
  );
}

export default StripeWrapper;
