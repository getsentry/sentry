import {useCallback} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {StepProps} from './types';

export function useWelcomeHandleComplete(onComplete: StepProps['onComplete']) {
  const organization = useOrganization();

  return useCallback(() => {
    trackAnalytics('onboarding.scm_welcome_continue_clicked', {organization});

    onComplete();
  }, [organization, onComplete]);
}
