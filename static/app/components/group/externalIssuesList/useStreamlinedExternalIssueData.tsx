import {useExternalIssues} from 'sentry/components/group/externalIssuesList/useExternalIssues';
import useFetchIntegrations from 'sentry/components/group/externalIssuesList/useFetchIntegrations';
import useIssueTrackingFilter from 'sentry/components/group/externalIssuesList/useIssueTrackingFilter';
import SentryAppComponentIcon from 'sentry/components/sentryAppComponentIcon';
import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {GroupIntegration} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {
  getIntegrationDisplayName,
  getIntegrationIcon,
} from 'sentry/utils/integrationUtil';
import useOrganization from 'sentry/utils/useOrganization';
import useSentryAppComponentsStore from 'sentry/utils/useSentryAppComponentsStore';

type Props = {
  event: Event;
  group: Group;
  project: Project;
};

interface BaseIssueAction {
  displayName: string;
  key: string;
  /**
   * Helper key to identify the source of the action
   */
  type: 'integration-issue' | 'sentry-app-issue' | 'plugin-issue' | 'plugin-action';
  displayIcon?: React.ReactNode;
}

/**
 * Linked issues that are already created
 */
interface LinkedIssue extends BaseIssueAction {
  onUnlink: () => void;
}

interface ExternalIssueAction {
  name: string;
  onClick: () => void;
}

/**
 * Integrations, apps, or plugins that can create external issues
 */
interface ExternalIssueIntegration extends BaseIssueAction {
  actions: ExternalIssueAction[];
}

/**
 * Each integration type will have a set of integrations and linked issues
 * eg - Sentry Apps, Integrations, Plugins each have a set of integrations and linked issues
 */
interface IntegrationResult {
  integrations: ExternalIssueIntegration[];
  linkedIssues: LinkedIssue[];
}

interface ExternalIssueData {
  integrations: ExternalIssueIntegration[];
  isLoading: boolean;
  linkedIssues: LinkedIssue[];
}

export default function useStreamLinedExternalIssueData({
  group,
  event,
  project,
}: Props): ExternalIssueData {
  const organization = useOrganization();
  const {
    data: integrations,
    isLoading: isLoadingIntegrations,
    refetch: refetchIntegrations,
  } = useFetchIntegrations({group, organization});
  const {data: externalIssues, isLoading: isLoadingExternalIssues} = useExternalIssues({
    group,
    organization,
  });
  const issueTrackingFilter = useIssueTrackingFilter();

  const components = useSentryAppComponentsStore({componentType: 'issue-link'});
  const sentryAppInstallations = useLegacyStore(SentryAppInstallationStore);

  const integrationItems: ExternalIssueIntegration[] = [];
  const linkedIssues: LinkedIssue[] = [];

  const renderIntegrationIssues = (): IntegrationResult => {
    if (!integrations) {
      return {integrations: [], linkedIssues: []};
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

    for (const [providerKey, configurations] of activeIntegrationsByProvider.entries()) {
      const actions = configurations.map<ExternalIssueAction>(config => ({
        name: config.name,
        onClick: () => {},
      }));
      const displayIcon = getIntegrationIcon(providerKey, 'sm');
      integrationItems.push({
        displayName: getIntegrationDisplayName(providerKey),
        key: providerKey,
        type: 'integration-issue',
        displayIcon,
        actions,
      });
      console.log(configurations);
      linkedIssues.push(
        ...configurations
          .filter(config => config.externalIssues.length > 0)
          .map<LinkedIssue>(config => ({
            type: 'integration-issue',
            key: config.externalIssues[0].id,
            displayName: config.externalIssues[0].key,
            displayIcon,
            onUnlink: () => {},
          }))
      );
    }

    return {integrations: integrationItems, linkedIssues};
  };

  // const renderSentryAppIssues = (): ExternalIssueItem[] => {
  //   return components
  //     .map<ExternalIssueItem | null>(component => {
  //       const {sentryApp, error: disabled} = component;
  //       const installation = sentryAppInstallations.find(
  //         i => i.app.uuid === sentryApp.uuid
  //       );
  //       // should always find a match but TS complains if we don't handle this case
  //       if (!installation) {
  //         return null;
  //       }

  //       const externalIssue = externalIssues.find(i => i.serviceType === sentryApp.slug);

  //       return {
  //         type: 'sentry-app-issue',
  //         key: sentryApp.slug,
  //         disabled,
  //         hasLinkedIssue: !!externalIssue,
  //         displayName: sentryApp.name,
  //         displayIcon: (
  //           <SentryAppComponentIcon sentryAppComponent={component} size={14} />
  //         ),
  //         props: {
  //           sentryApp,
  //           group,
  //           organization,
  //           event,
  //           sentryAppComponent: component,
  //           sentryAppInstallation: installation,
  //           externalIssue,
  //           disabled,
  //         },
  //       };
  //     })
  //     .filter((x): x is ExternalIssueItem => x !== null);
  // };

  // const renderPluginIssues = (): ExternalIssueItem[] => {
  //   return group.pluginIssues?.map((plugin, i) => ({
  //     type: 'plugin-issue',
  //     key: `plugin-issue-${i}`,
  //     disabled: false,
  //     hasLinkedIssue: true,
  //     displayName: plugin.shortName,
  //     displayIcon: getIntegrationIcon(plugin.id, 'sm'),
  //     props: {
  //       group,
  //       project,
  //       plugin,
  //     },
  //   }));
  // };

  // const renderPluginActions = (): ExternalIssueItem[] => {
  //   return (
  //     group.pluginActions?.map((plugin, i) => ({
  //       type: 'plugin-action',
  //       key: `plugin-action-${i}`,
  //       displayName: plugin.shortName,
  //       disabled: false,
  //       hasLinkedIssue: false,
  //       props: {plugin},
  //     })) ?? []
  //   );
  // };

  const results = [
    renderIntegrationIssues(),
    // ...renderSentryAppIssues(),
    // ...renderPluginActions(),
    // ...renderPluginIssues(),
  ];

  return {
    isLoading: isLoadingExternalIssues || isLoadingIntegrations,
    integrations: results.flatMap(result => result.integrations),
    linkedIssues: results.flatMap(result => result.linkedIssues),
  };
}
