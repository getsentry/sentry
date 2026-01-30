import {useCallback} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import type {StepProps} from './types';

export function useWelcomeHandleComplete(onComplete: StepProps['onComplete']) {
  const organization = useOrganization();
  const source = 'targeted_onboarding';

  return useCallback(() => {
    trackAnalytics('growth.onboarding_clicked_instrument_app', {
      organization,
      source,
    });

    onComplete();
  }, [organization, onComplete]);
}
