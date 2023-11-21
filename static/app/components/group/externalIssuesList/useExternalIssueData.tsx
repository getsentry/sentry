import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalIssueActions from 'sentry/components/group/externalIssuesList/externalIssueActions';
import useFetchIntegrations from 'sentry/components/group/externalIssuesList/useFetchIntegrations';
import useFetchSentryAppData from 'sentry/components/group/externalIssuesList/useFetchSentryAppData';
import useIssueTrackingFilter from 'sentry/components/group/externalIssuesList/useIssueTrackingFilter';
import PluginActions from 'sentry/components/group/pluginActions';
import SentryAppExternalIssueActions from 'sentry/components/group/sentryAppExternalIssueActions';
import IssueSyncListElement from 'sentry/components/issueSyncListElement';
import ExternalIssueStore from 'sentry/stores/externalIssueStore';
import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Group, GroupIntegration, Project, SentryAppComponent} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  components: SentryAppComponent[];
  event: Event;
  group: Group;
  project: Project;
};

type ExternalIssueComponent = {
  key: string;
  render: () => React.ReactNode;
  disabled?: boolean;
  hasLinkedIssue?: boolean;
};

export default function useExternalIssueData({components, group, event, project}: Props) {
  const organization = useOrganization();
  const {
    data: integrations,
    isLoading,
    refetch: refetchIntegrations,
  } = useFetchIntegrations({group, organization});
  useFetchSentryAppData({group, organization});
  const issueTrackingFilter = useIssueTrackingFilter();

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
        key: provider,
        disabled: false,
        hasLinkedIssue: configurations.some(x => x.externalIssues.length > 0),
        render: () => (
          <ExternalIssueActions
            configurations={configurations}
            group={group}
            onChange={() => refetchIntegrations()}
          />
        ),
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
          key: sentryApp.slug,
          disabled,
          hasLinkedIssue: !!issue,
          render: () => (
            <ErrorBoundary key={sentryApp.slug} mini>
              <SentryAppExternalIssueActions
                group={group}
                organization={organization}
                event={event}
                sentryAppComponent={component}
                sentryAppInstallation={installation}
                externalIssue={issue}
                disabled={disabled}
              />
            </ErrorBoundary>
          ),
        };
      })
      .filter((x): x is ExternalIssueComponent => x !== null);
  };

  const renderPluginIssues = (): ExternalIssueComponent[] => {
    return group.pluginIssues?.map((plugin, i) => ({
      key: `plugin-issue-${i}`,
      disabled: false,
      hasLinkedIssue: true,
      render: () => <PluginActions group={group} project={project} plugin={plugin} />,
    }));
  };

  const renderPluginActions = (): ExternalIssueComponent[] => {
    return (
      group.pluginActions?.map((plugin, i) => ({
        key: `plugin-action-${i}`,
        disabled: false,
        hasLinkedIssue: false,
        render: () => (
          <IssueSyncListElement externalIssueLink={plugin[1]}>
            {plugin[0]}
          </IssueSyncListElement>
        ),
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
