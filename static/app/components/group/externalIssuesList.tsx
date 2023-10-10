import {Fragment, useEffect} from 'react';

import AlertLink from 'sentry/components/alertLink';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalIssueActions from 'sentry/components/group/externalIssueActions';
import PluginActions from 'sentry/components/group/pluginActions';
import SentryAppExternalIssueActions from 'sentry/components/group/sentryAppExternalIssueActions';
import IssueSyncListElement from 'sentry/components/issueSyncListElement';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import ExternalIssueStore from 'sentry/stores/externalIssueStore';
import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {
  Group,
  GroupIntegration,
  OrganizationSummary,
  PlatformExternalIssue,
  Project,
  SentryAppComponent,
} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import withSentryAppComponents from 'sentry/utils/withSentryAppComponents';

type Props = {
  components: SentryAppComponent[];
  event: Event;
  group: Group;
  project: Project;
};

const issueTrackingFilterKey = 'issueTrackingFilter';

type ExternalIssueComponent = {
  component: React.ReactNode;
  key: string;
  disabled?: boolean;
  hasLinkedIssue?: boolean;
};

function makeIntegrationsQueryKey(
  group: Group,
  organization: OrganizationSummary
): ApiQueryKey {
  return [`/organizations/${organization.slug}/issues/${group.id}/integrations/`];
}

function useFetchIntegrations({
  group,
  organization,
}: {
  group: Group;
  organization: OrganizationSummary;
}) {
  return useApiQuery<GroupIntegration[]>(makeIntegrationsQueryKey(group, organization), {
    staleTime: Infinity,
  });
}

// We want to do this explicitly so that we can handle errors gracefully,
// instead of the entire component not rendering.
//
// Part of the API request here is fetching data from the Sentry App, so
// we need to be more conservative about error cases since we don't have
// control over those services.
//
function useFetchSentryAppData({
  group,
  organization,
}: {
  group: Group;
  organization: OrganizationSummary;
}) {
  const {data} = useApiQuery<PlatformExternalIssue[]>(
    [`/organizations/${organization.slug}/issues/${group.id}/external-issues/`],
    {staleTime: 30_000}
  );

  useEffect(() => {
    if (data) {
      ExternalIssueStore.load(data);
    }
  }, [data]);
}

function useIssueTrackingFilter() {
  const location = useLocation();
  const issueTrackingQueryParam = location.query.issueTracking;
  const [issueTracking, setIssueTracking] = useLocalStorageState<string>(
    issueTrackingFilterKey,
    'all'
  );
  const issueTrackingFilter = ['', 'all'].includes(issueTracking)
    ? undefined
    : issueTracking;

  useEffect(() => {
    if (typeof issueTrackingQueryParam === 'string') {
      setIssueTracking(issueTrackingQueryParam);
    }
  }, [issueTrackingQueryParam, setIssueTracking]);

  return issueTrackingFilter;
}

function ExternalIssueList({components, group, event, project}: Props) {
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

  if (isLoading) {
    return (
      <SidebarSection.Wrap data-test-id="linked-issues">
        <SidebarSection.Title>{t('Issue Tracking')}</SidebarSection.Title>
        <SidebarSection.Content>
          <Placeholder height="120px" />
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }

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
        component: (
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
          component: (
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
      component: <PluginActions group={group} project={project} plugin={plugin} />,
    }));
  };

  const renderPluginActions = (): ExternalIssueComponent[] => {
    return (
      group.pluginActions?.map((plugin, i) => ({
        key: `plugin-action-${i}`,
        disabled: false,
        hasLinkedIssue: false,
        component: (
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
  ].filter(action => !issueTrackingFilter || action.key === issueTrackingFilter);
  const showSetup = actions.length === 0;

  return (
    <SidebarSection.Wrap data-test-id="linked-issues">
      <SidebarSection.Title>{t('Issue Tracking')}</SidebarSection.Title>
      <SidebarSection.Content>
        {showSetup && (
          <AlertLink
            priority="muted"
            size="small"
            to={`/settings/${organization.slug}/integrations/?category=issue%20tracking`}
          >
            {t('Track this issue in Jira, GitHub, etc.')}
          </AlertLink>
        )}
        {actions
          // Put disabled actions last
          .sort((a, b) => Number(a.disabled) - Number(b.disabled))
          // Put actions with linked issues first
          .sort((a, b) => Number(b.hasLinkedIssue) - Number(a.hasLinkedIssue))
          .map(({component, key}) => (
            <Fragment key={key}>{component}</Fragment>
          ))}
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}

export default withSentryAppComponents(ExternalIssueList, {
  componentType: 'issue-link',
});
