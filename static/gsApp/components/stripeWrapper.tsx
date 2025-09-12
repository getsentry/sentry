import React from 'react';
import {useTheme} from '@emotion/react';
import {Elements} from '@stripe/react-stripe-js';

import {debossedBackground} from 'sentry/components/core/chonk';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

import {useStripeInstance} from 'getsentry/hooks/useStripeInstance';

function StripeWrapper({
  mode,
  children,
}: {
  children: React.ReactNode;
  mode?: 'setup' | 'payment';
}) {
  const stripe = useStripeInstance();
  const theme = useTheme();
  const prefersDarkMode = useLegacyStore(ConfigStore).theme === 'dark';

  return (
    <Elements
      stripe={stripe}
      options={{
        mode,
        currency: 'usd',
        loader: 'always',
        setupFutureUsage: mode ? 'off_session' : undefined,
        captureMethod: mode ? 'manual' : undefined,
        paymentMethodTypes: mode ? ['card'] : undefined,
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
      }}
    >
      {children}
    </Elements>
  );
}

export default StripeWrapper;
