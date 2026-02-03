import {useCallback} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {ONBOARDING_WELCOME_SCREEN_SOURCE} from 'sentry/views/onboarding/consts';

import type {StepProps} from './types';

export function useWelcomeHandleComplete(onComplete: StepProps['onComplete']) {
  const organization = useOrganization();

  return useCallback(() => {
    trackAnalytics('growth.onboarding_clicked_instrument_app', {
      organization,
      source: ONBOARDING_WELCOME_SCREEN_SOURCE,
    });

    onComplete();
  }, [organization, onComplete]);
}
