import {ExternalIssueComponent} from 'sentry/components/group/externalIssuesList/types';
import useFetchIntegrations from 'sentry/components/group/externalIssuesList/useFetchIntegrations';
import useFetchSentryAppData from 'sentry/components/group/externalIssuesList/useFetchSentryAppData';
import useIssueTrackingFilter from 'sentry/components/group/externalIssuesList/useIssueTrackingFilter';
import ExternalIssueStore from 'sentry/stores/externalIssueStore';
import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Group, GroupIntegration, Project} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';
import useSentryAppComponentsStore from 'sentry/utils/useSentryAppComponentsStore';

type Props = {
  event: Event;
  group: Group;
  project: Project;
};

export default function useExternalIssueData({group, event, project}: Props) {
  const organization = useOrganization();
  const {
    data: integrations,
    isLoading,
    refetch: refetchIntegrations,
  } = useFetchIntegrations({group, organization});
  useFetchSentryAppData({group, organization});
  const issueTrackingFilter = useIssueTrackingFilter();

  const components = useSentryAppComponentsStore({componentType: 'issue-link'});
  const externalIssues = useLegacyStore(ExternalIssueStore);
  const sentryAppInstallations = useLegacyStore(SentryAppInstallationStore);

  const renderIntegrationIssues = (): ExternalIssueComponent[] => {
    if (!integrations) {
      return [];
    }

    const activeIntegrations = integrations.filter(
      integration => integration.status === 'active'
    );

    const activeIntegrationsByProvider: Map<string, GroupIntegration[]> =
      activeIntegrations.reduce((acc, curr) => {
        const items = acc.get(curr.provider.key);

        if (items) {
          acc.set(curr.provider.key, [...items, curr]);
        } else {
          acc.set(curr.provider.key, [curr]);
        }
        return acc;
      }, new Map());

    return [...activeIntegrationsByProvider.entries()].map(
      ([provider, configurations]) => ({
        type: 'integration-issue',
        key: provider,
        disabled: false,
        hasLinkedIssue: configurations.some(x => x.externalIssues.length > 0),
        props: {
          configurations,
          group,
          onChange: refetchIntegrations,
        },
      })
    );
  };

  const renderSentryAppIssues = (): ExternalIssueComponent[] => {
    return components
      .map<ExternalIssueComponent | null>(component => {
        const {sentryApp, error: disabled} = component;
        const installation = sentryAppInstallations.find(
          i => i.app.uuid === sentryApp.uuid
        );
        // should always find a match but TS complains if we don't handle this case
        if (!installation) {
          return null;
        }

        const issue = (externalIssues || []).find(i => i.serviceType === sentryApp.slug);

        return {
          type: 'sentry-app-issue',
          key: sentryApp.slug,
          disabled,
          hasLinkedIssue: !!issue,
          props: {
            sentryApp,
            group,
            organization,
            event,
            sentryAppComponent: component,
            sentryAppInstallation: installation,
            externalIssue: issue,
            disabled,
          },
        };
      })
      .filter((x): x is ExternalIssueComponent => x !== null);
  };

  const renderPluginIssues = (): ExternalIssueComponent[] => {
    return group.pluginIssues?.map((plugin, i) => ({
      type: 'plugin-issue',
      key: `plugin-issue-${i}`,
      disabled: false,
      hasLinkedIssue: true,
      props: {
        group,
        project,
        plugin,
      },
    }));
  };

  const renderPluginActions = (): ExternalIssueComponent[] => {
    return (
      group.pluginActions?.map((plugin, i) => ({
        type: 'plugin-action',
        key: `plugin-action-${i}`,
        disabled: false,
        hasLinkedIssue: false,
        props: {plugin},
      })) ?? []
    );
  };

  const actions = [
    ...renderSentryAppIssues(),
    ...renderIntegrationIssues(),
    ...renderPluginIssues(),
    ...renderPluginActions(),
  ]
    .filter(action => !issueTrackingFilter || action.key === issueTrackingFilter)
    // Put disabled actions last
    .sort((a, b) => Number(a.disabled) - Number(b.disabled))
    // Put actions with linked issues first
    .sort((a, b) => Number(b.hasLinkedIssue) - Number(a.hasLinkedIssue));

  return {
    isLoading,
    actions,
  };
}
