import {useIssueTrackingFilter} from 'sentry/components/group/externalIssuesList/useIssueTrackingFilter';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';

import type {GroupIntegrationIssueResult} from './types';
import {useIntegrationExternalIssues} from './useIntegrationExternalIssues';
import {useSentryAppExternalIssues} from './useSentryAppExternalIssues';

interface Props {
  event: Event;
  group: Group;
}

export function useGroupExternalIssues({
  group,
  event,
}: Props): GroupIntegrationIssueResult {
  const issueTrackingFilter = useIssueTrackingFilter();

  const {
    integrations: realIntegrations,
    linkedIssues: integrationLinkedIssues,
    isLoading: isLoadingIntegrations,
  } = useIntegrationExternalIssues({group});

  const {
    isLoading: isLoadingSentryApp,
    integrations: sentryAppIntegrations,
    linkedIssues: sentryAppLinkedIssues,
  } = useSentryAppExternalIssues({group, event});

  const integrations = [...realIntegrations, ...sentryAppIntegrations]
    .filter(action => !issueTrackingFilter || action.key === issueTrackingFilter)
    .sort((a, b) => {
      if (a.disabled && !b.disabled) {
        return 1;
      }
      if (!a.disabled && b.disabled) {
        return -1;
      }

      return a.displayName.localeCompare(b.displayName);
    });

  return {
    isLoading: isLoadingSentryApp || isLoadingIntegrations,
    integrations,
    linkedIssues: [...integrationLinkedIssues, ...sentryAppLinkedIssues],
  };
}
