import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

import useIssueTrackingFilter from '../useIssueTrackingFilter';

import type {GroupIntegrationIssueResult} from './types';
import {useIntegrationExternalIssues} from './useIntegrationExternalIssues';
import {usePluginExternalIssues} from './usePluginExternalIssues';
import {useSentryAppExternalIssues} from './useSentryAppExternalIssues';

interface Props {
  event: Event;
  group: Group;
  project: Project;
}

/**
 * Aggregates external issues from integrations, plugins, and sentry apps
 */
export default function useGroupExternalIssues({
  group,
  event,
  project,
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

  const {integrations: pluginIntegrations, linkedIssues: pluginLinkedIssues} =
    usePluginExternalIssues({group, project});

  const integrations = [
    ...realIntegrations,
    ...pluginIntegrations,
    ...sentryAppIntegrations,
  ]
    .filter(action => !issueTrackingFilter || action.key === issueTrackingFilter)
    // Sort alphabetically
    // Put disabled actions last
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
    linkedIssues: [
      ...integrationLinkedIssues,
      ...pluginLinkedIssues,
      ...sentryAppLinkedIssues,
    ],
  };
}
