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

import ProfilingOnboarding from './profilingOnboarding';

function renderNoAccess() {
  return (
    <PageContent>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </PageContent>
  );
}

function shouldShowProfilingOnboarding(state: RequestState<PromptData>): boolean {
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
  const client = useApi();

  const [requestState, setRequestState] = useState<RequestState<PromptData>>({
    type: 'initial',
  });

  // Fetch prompt data and see if we need to show the onboarding.
  useEffect(() => {
    setRequestState({type: 'loading'});
    promptsCheck(client, {
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
  }, [client, organization]);

  // Eagerly update state and update check
  const dismissPrompt = useCallback(
    (status: 'done' | 'dismissed') => {
      setRequestState({type: 'resolved', data: {dismissedTime: Date.now()}});
      trackAdvancedAnalyticsEvent(
        status === 'done'
          ? 'profiling_views.onboarding_action.done'
          : 'profiling_views.onboarding_action.dismiss',
        {
          action: status === 'done' ? 'done' : 'dismiss',
          organization,
        }
      );

      return promptsUpdate(client, {
        feature: 'profiling_onboarding',
        organizationId: organization.id,
        // This will always send dismissed, becuse we dont actually
        // care about the snooze mechanism. It would be awkward to suddenly
        // creep a full page into view.
        status: 'dismissed',
      });
    },
    [organization, client]
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
      renderDisabled={renderNoAccess}
    >
      {requestState.type === 'loading' ? (
        <LoadingIndicator />
      ) : shouldShowProfilingOnboarding(requestState) ? (
        <ProfilingOnboarding
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
