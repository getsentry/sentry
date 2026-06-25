import {useCallback} from 'react';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';

import {useRedirectPopupStep, type PopupOptions} from './useRedirectPopupStep';

export interface OAuthCallbackData {
  code: string;
  rest: Record<string, string>;
  state: string;
}

interface OAuthLoginStepProps {
  onOAuthCallback: (data: OAuthCallbackData) => void;
  serviceName: string;
  /** Overrides the default intro copy */
  description?: string;
  isLoading?: boolean;
  oauthUrl?: string;
  popup?: PopupOptions;
}

export function OAuthLoginStep({
  oauthUrl,
  isLoading,
  serviceName,
  onOAuthCallback,
  popup,
  description,
}: OAuthLoginStepProps) {
  const handleCallback = useCallback(
    (raw: Record<string, string>) => {
      const {code = '', state = '', ...rest} = raw;
      onOAuthCallback({code, state, rest});
    },
    [onOAuthCallback]
  );

  const {openPopup, popupStatus} = useRedirectPopupStep({
    redirectUrl: oauthUrl,
    onCallback: handleCallback,
    popup,
  });

  return (
    <Stack gap="lg" align="start">
      <Stack gap="sm">
        <Text>
          {description ??
            tct(
              'Authorize your [service] account with Sentry to complete the integration setup.',
              {service: serviceName}
            )}
        </Text>
        {popupStatus === 'popup-open' && (
          <Text variant="muted" size="sm">
            {tct('A popup should have opened to authorize with [service].', {
              service: serviceName,
            })}
          </Text>
        )}
        {popupStatus === 'failed-to-open' && (
          <Text variant="danger" size="sm">
            {t(
              'The authorization popup was blocked by your browser. Please ensure popups are allowed and try again.'
            )}
          </Text>
        )}
      </Stack>
      {popupStatus === 'popup-open' && !isLoading ? (
        <Button size="sm" onClick={openPopup}>
          {t('Reopen authorization window')}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="primary"
          onClick={openPopup}
          busy={isLoading}
          disabled={!oauthUrl}
        >
          {tct('Authorize [service]', {service: serviceName})}
        </Button>
      )}
    </Stack>
  );
}
