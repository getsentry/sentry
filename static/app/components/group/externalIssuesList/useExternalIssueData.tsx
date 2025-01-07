import type {ExternalIssueComponent} from 'sentry/components/group/externalIssuesList/types';
import {useExternalIssues} from 'sentry/components/group/externalIssuesList/useExternalIssues';
import useFetchIntegrations from 'sentry/components/group/externalIssuesList/useFetchIntegrations';
import useIssueTrackingFilter from 'sentry/components/group/externalIssuesList/useIssueTrackingFilter';
import {sentryAppComponentIsDisabled} from 'sentry/components/sentryAppComponentIcon';
import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {GroupIntegration} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
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
    isPending: isLoadingIntegrations,
    refetch: refetchIntegrations,
  } = useFetchIntegrations({group, organization});
  const {data: externalIssues, isLoading: isLoadingExternalIssues} = useExternalIssues({
    group,
    organization,
  });
  const issueTrackingFilter = useIssueTrackingFilter();

  const components = useSentryAppComponentsStore({componentType: 'issue-link'});
  const sentryAppInstallations = useLegacyStore(SentryAppInstallationStore);

  const renderIntegrationIssues = (): ExternalIssueComponent[] => {
    if (!integrations) {
      return [];
    }

    const activeIntegrations = integrations.filter(
      integration => integration.status === 'active'
    );

    const activeIntegrationsByProvider = activeIntegrations.reduce((acc, curr) => {
      const items = acc.get(curr.provider.key);

      if (items) {
        acc.set(curr.provider.key, [...items, curr]);
      } else {
        acc.set(curr.provider.key, [curr]);
      }
      return acc;
    }, new Map<string, GroupIntegration[]>());

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
        const {sentryApp} = component;
        const disabled = sentryAppComponentIsDisabled(component);
        const installation = sentryAppInstallations.find(
          i => i.app.uuid === sentryApp.uuid
        );
        // should always find a match but TS complains if we don't handle this case
        if (!installation) {
          return null;
        }

        const externalIssue = externalIssues.find(i => i.serviceType === sentryApp.slug);

        return {
          type: 'sentry-app-issue',
          key: sentryApp.slug,
          disabled,
          hasLinkedIssue: !!externalIssue,
          props: {
            sentryApp,
            group,
            organization,
            event,
            sentryAppComponent: component,
            sentryAppInstallation: installation,
            externalIssue,
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
    isLoading: isLoadingExternalIssues || isLoadingIntegrations,
    actions,
  };
}
