import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

import type {IntegrationResult} from './hooks/types';
import {useIntegrationExternalIssues} from './hooks/useIntegrationExternalIssues';
import {usePluginExternalIssues} from './hooks/usePluginExternalIssues';
import {useSentryAppExternalIssues} from './hooks/useSentryAppExternalIssues';
import useIssueTrackingFilter from './useIssueTrackingFilter';

type Props = {
  event: Event;
  group: Group;
  project: Project;
};

export default function useStreamLinedExternalIssueData({
  group,
  event,
  project,
}: Props): IntegrationResult {
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

  return {
    isLoading: isLoadingSentryApp || isLoadingIntegrations,
    integrations: [
      ...realIntegrations,
      ...pluginIntegrations,
      ...sentryAppIntegrations,
    ].filter(action => !issueTrackingFilter || action.key === issueTrackingFilter),
    linkedIssues: [
      ...integrationLinkedIssues,
      ...pluginLinkedIssues,
      ...sentryAppLinkedIssues,
    ],
  };
}
