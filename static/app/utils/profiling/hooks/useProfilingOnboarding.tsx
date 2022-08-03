import {useCallback, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {PromptData, promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import {t} from 'sentry/locale';
import {RequestState} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function useProfilingOnboarding(): [RequestState<PromptData>, () => void] {
  const api = useApi();
  const organization = useOrganization();

  const [requestState, setRequestState] = useState<RequestState<PromptData>>({
    type: 'initial',
  });

  // Fetch prompt data and see if we need to show the onboarding.
  useEffect(() => {
    setRequestState({type: 'loading'});
    promptsCheck(api, {
      organizationId: organization.id,
      feature: 'profiling_onboarding',
    })
      .then(data => {
        setRequestState({type: 'resolved', data});
      })
      .catch(e => {
        Sentry.captureException(e);
        setRequestState({type: 'errored', error: t('Error: Unable to load prompt data')});
      });
  }, [api, organization]);

  // Eagerly update state and update check
  const dismissPrompt = useCallback(() => {
    setRequestState({type: 'resolved', data: {dismissedTime: Date.now()}});
    trackAdvancedAnalyticsEvent('profiling_views.onboarding_action', {
      action: 'dismissed',
      organization,
    });

    return promptsUpdate(api, {
      feature: 'profiling_onboarding',
      organizationId: organization.id,
      // This will always send dismissed, becuse we dont actually
      // care about the snooze mechanism. It would be awkward to suddenly
      // creep a full page into view.
      status: 'dismissed',
    });
  }, [organization, api]);

  return [requestState, dismissPrompt];
}
