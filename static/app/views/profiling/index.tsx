import {useCallback, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {PromptData, promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization, RequestState} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';

import LegacyProfilingOnboarding from './legacyProfilingOnboarding';

function shouldShowLegacyProfilingOnboarding(state: RequestState<PromptData>): boolean {
  if (state.type === 'resolved') {
    return typeof state.data?.dismissedTime !== 'number';
  }

  return false;
}

type Props = {
  children: React.ReactChildren;
  organization: Organization;
};

function ProfilingContainer({organization, children}: Props) {
  const api = useApi();

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
  const dismissPrompt = useCallback(
    (status: 'done' | 'dismissed') => {
      setRequestState({type: 'resolved', data: {dismissedTime: Date.now()}});
      trackAdvancedAnalyticsEvent('profiling_views.onboarding_action', {
        action: status,
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
    },
    [organization, api]
  );

  const handleDone = useCallback(() => {
    dismissPrompt('done');
  }, [dismissPrompt]);

  const handleDismiss = useCallback(() => {
    dismissPrompt('dismissed');
  }, [dismissPrompt]);

  return (
    <Feature
      hookName="feature-disabled:profiling-page"
      features={['profiling']}
      organization={organization}
      renderDisabled={() => (
        <PageContent>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </PageContent>
      )}
    >
      {requestState.type === 'loading' ? (
        <LoadingIndicator />
      ) : shouldShowLegacyProfilingOnboarding(requestState) ? (
        <LegacyProfilingOnboarding
          organization={organization}
          onDismissClick={handleDismiss}
          onDoneClick={handleDone}
        />
      ) : (
        children
      )}
    </Feature>
  );
}

export default withOrganization(ProfilingContainer);
