import React from 'react';
import {useTheme} from '@emotion/react';
import {Elements} from '@stripe/react-stripe-js';

import {debossedBackground} from 'sentry/components/core/chonk';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

import {useStripeInstance} from 'getsentry/hooks/useStripeInstance';

function StripeWrapper({
  paymentElementMode,
  children,
}: {
  children: React.ReactNode;
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
        captureMethod: 'manual' as const,
        paymentMethodTypes: ['card'],
      }
    : {};

  return (
    <Elements
      stripe={stripe}
      options={{
        currency: 'usd',
        loader: 'always',
        fonts: [
          {
            family: 'Rubik',
            cssSrc:
              'https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300..900;1,300..900&display=swap',
          },
        ],
        appearance: {
          theme: prefersDarkMode ? 'night' : 'stripe',
          variables: {
            fontFamily: theme.text.family,
            borderRadius: theme.borderRadius,
            colorBackground: theme.background,
            colorText: theme.textColor,
            colorDanger: theme.danger,
            colorSuccess: theme.success,
            colorWarning: theme.warning,
            iconColor: theme.textColor,
          },
          rules: {
            '.Input': {
              fontSize: theme.fontSize.md,
              boxShadow: `0px 2px 0px 0px ${theme.tokens.border.primary} inset`,
              backgroundColor: debossedBackground(theme as any).backgroundColor,
              padding: `${theme.space.lg} ${theme.space.xl}`,
            },
            '.Label': {
              fontSize: theme.fontSize.sm,
              color: theme.subText,
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
