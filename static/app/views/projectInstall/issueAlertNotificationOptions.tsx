import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {Stack} from '@sentry/scraps/layout';

import {MultipleCheckbox} from 'sentry/components/forms/controls/multipleCheckbox';
import {useCreateProjectRules} from 'sentry/components/onboarding/useCreateProjectRules';
import {t, tct} from 'sentry/locale';
import {
  IssueAlertActionType,
  type IntegrationAction,
  type IssueAlertRuleAction,
} from 'sentry/types/alerts';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  MessagingIntegrationAnalyticsView,
  SetupMessagingIntegrationButton,
} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';
import {MessagingIntegrationAlertRule} from 'sentry/views/projectInstall/messagingIntegrationAlertRule';

export const providerDetails = {
  slack: {
    name: t('Slack'),
    action: IssueAlertActionType.SLACK,
    placeholder: t('channel, e.g. #critical'),
    makeSentence: ({providerName, integrationName, target}: any) =>
      tct(
        'Send [providerName] notification to the [integrationName] workspace to [target]',
        {
          providerName,
          integrationName,
          target,
        }
      ),
  },
  discord: {
    name: t('Discord'),
    action: IssueAlertActionType.DISCORD,
    placeholder: t('channel ID or URL'),
    makeSentence: ({providerName, integrationName, target}: any) =>
      tct(
        'Send [providerName] notification to the [integrationName] server in the channel [target]',
        {
          providerName,
          integrationName,
          target,
        }
      ),
  },
  msteams: {
    name: t('MS Teams'),
    action: IssueAlertActionType.MS_TEAMS,
    placeholder: t('channel ID'),
    makeSentence: ({providerName, integrationName, target}: any) =>
      tct('Send [providerName] notification to the [integrationName] team to [target]', {
        providerName,
        integrationName,
        target,
      }),
  },
};

export const enum MultipleCheckboxOptions {
  EMAIL = 'email',
  INTEGRATION = 'integration',
}

export type IntegrationChannel = {
  label: ReactNode;
  value: string;
  new?: boolean;
};

export type IssueAlertNotificationProps = {
  actions: MultipleCheckboxOptions[];
  integration: OrganizationIntegration | undefined;
  provider: string | undefined;
  providersToIntegrations: Record<string, OrganizationIntegration[]>;
  queryError: boolean;
  querySuccess: boolean;
  setActions: (action: MultipleCheckboxOptions[]) => void;
  setChannel: (channel?: IntegrationChannel) => void;
  setIntegration: (integration: OrganizationIntegration | undefined) => void;
  setProvider: (provider: string | undefined) => void;
  shouldRenderSetupButton: boolean;
  channel?: IntegrationChannel;
};

/**
 * Builds the serializable IntegrationAction for the current messaging
 * selection. Returns undefined if the provider is unrecognised or unset.
 * Exported so callers can persist the action snapshot and use it as
 * `defaultActions` on the next mount to restore the selection.
 */
export function buildIntegrationAction({
  provider,
  integration,
  channel,
}: Pick<IssueAlertNotificationProps, 'provider' | 'integration' | 'channel'>):
  | IntegrationAction
  | undefined {
  switch (provider) {
    case 'slack':
      return {
        id: IssueAlertActionType.SLACK,
        workspace: integration?.id,
        channel: channel?.value,
      };
    case 'discord':
      return {
        id: IssueAlertActionType.DISCORD,
        server: integration?.id,
        channel_id: channel?.value,
      };
    case 'msteams':
      return {
        id: IssueAlertActionType.MS_TEAMS,
        team: integration?.id,
        channel: channel?.value,
      };
    default:
      return undefined;
  }
}

export function useCreateNotificationAction({
  actions: defaultActions,
}: Partial<Pick<RequestDataFragment, 'actions'>> = {}) {
  const organization = useOrganization();
  const createProjectRules = useCreateProjectRules();

  const messagingIntegrationsQuery = useApiQuery<OrganizationIntegration[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/integrations/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {integrationType: 'messaging'}},
    ],
    {staleTime: 0, refetchOnWindowFocus: true}
  );

  const providersToIntegrations = useMemo(() => {
    const map: Record<string, OrganizationIntegration[]> = {};
    if (messagingIntegrationsQuery.data) {
      for (const i of messagingIntegrationsQuery.data) {
        if (i.status === 'active') {
          const providerSlug = i.provider.slug;
          map[providerSlug] = map[providerSlug] ?? [];
          map[providerSlug].push(i);
        }
      }
    }
    return map;
  }, [messagingIntegrationsQuery.data]);

  const [actions, setActions] = useState<MultipleCheckboxOptions[]>([
    MultipleCheckboxOptions.EMAIL,
  ]);
  const [provider, setProvider] = useState<string | undefined>(undefined);
  const [integration, setIntegration] = useState<OrganizationIntegration | undefined>(
    undefined
  );
  const [channel, setChannel] = useState<IntegrationChannel | undefined>(undefined);
  const [shouldRenderSetupButton, setShouldRenderSetupButton] = useState(false);

  const hasInitializedSelection = useRef(false);

  function getIntegrationId(action: IssueAlertRuleAction): string | undefined {
    switch (action.id) {
      case IssueAlertActionType.SLACK:
        return action.workspace;
      case IssueAlertActionType.DISCORD:
        return action.server;
      case IssueAlertActionType.MS_TEAMS:
        return action.team;
      default:
        return undefined;
    }
  }

  // Seeds the notification picker once, after the integrations query resolves:
  // restores the provider/integration/channel from a default action when one is
  // present, otherwise auto-selects the first available integration. Guarded by
  // a ref so it runs a single time and never overwrites later user edits.
  useEffect(() => {
    if (!messagingIntegrationsQuery.isSuccess || hasInitializedSelection.current) {
      return;
    }

    const firstAction = defaultActions?.[0];
    if (firstAction) {
      // Restore from a persisted/default action (e.g. back-nav). Provider key is
      // derived from the action's id; integration is matched by integrationId if
      // present, falling back to the first in the list.
      const matchedProviderKey = Object.keys(providerDetails).find(
        key =>
          providerDetails[key as keyof typeof providerDetails].action === firstAction.id
      );
      const integrationId = getIntegrationId(firstAction);
      const integrationList = matchedProviderKey
        ? (providersToIntegrations[matchedProviderKey] ?? [])
        : [];
      const matchedIntegration = integrationId
        ? integrationList.find(i => i.id === integrationId)
        : integrationList[0];

      // Integration action whose integration hasn't loaded yet: show the setup CTA
      // and wait for a refetch to deliver it. Don't latch or half-apply the
      // restore, so the picker can't look submittable with an unresolved integration.
      const isIntegrationAction = firstAction.id !== IssueAlertActionType.NOTIFY_EMAIL;
      if (isIntegrationAction && !matchedIntegration) {
        setShouldRenderSetupButton(true);
        return;
      }

      setProvider(matchedProviderKey);
      setIntegration(matchedIntegration);
      setShouldRenderSetupButton(!matchedIntegration);

      const newActions =
        firstAction.id === IssueAlertActionType.NOTIFY_EMAIL
          ? [MultipleCheckboxOptions.EMAIL]
          : [MultipleCheckboxOptions.EMAIL, MultipleCheckboxOptions.INTEGRATION];
      setActions(newActions);

      const restoredChannel = firstAction.channel ?? firstAction.channel_id;
      if (restoredChannel) {
        // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
        setChannel({label: restoredChannel, value: restoredChannel});
      }

      hasInitializedSelection.current = true;
      return;
    }

    // No persisted action: auto-select the first available provider/integration.
    const providerKeys = Object.keys(providersToIntegrations);
    const firstProvider = providerKeys[0];
    if (!firstProvider) {
      // No integrations yet: show the setup CTA and do NOT latch, so this
      // effect re-runs after the user connects one and the query refetches.
      setShouldRenderSetupButton(true);
      return;
    }
    hasInitializedSelection.current = true;
    const firstIntegration = providersToIntegrations[firstProvider]?.[0];
    setProvider(firstProvider);
    setIntegration(firstIntegration);
    setChannel(undefined);
    setShouldRenderSetupButton(false);
  }, [messagingIntegrationsQuery.isSuccess, providersToIntegrations, defaultActions]);

  const createNotificationAction = useCallback(
    ({
      shouldCreateRule,
      projectSlug,
      name,
      conditions,
      actionMatch,
      frequency,
    }: Partial<RequestDataFragment> & {projectSlug: string}) => {
      const isCreatingIntegrationNotification = actions.find(
        action => action === MultipleCheckboxOptions.INTEGRATION
      );
      if (!shouldCreateRule || !isCreatingIntegrationNotification) {
        return;
      }

      const integrationAction = buildIntegrationAction({provider, integration, channel});
      if (!integrationAction) {
        return;
      }

      return createProjectRules.mutateAsync({
        projectSlug,
        name,
        conditions,
        actions: [integrationAction],
        actionMatch,
        frequency,
      });
    },
    [actions, provider, integration, channel, createProjectRules]
  );

  return {
    createNotificationAction,
    notificationProps: {
      actions,
      provider,
      integration,
      channel,
      setActions,
      setProvider,
      setIntegration,
      setChannel,
      providersToIntegrations,
      queryError: messagingIntegrationsQuery.isError,
      querySuccess: messagingIntegrationsQuery.isSuccess,
      shouldRenderSetupButton,
    },
  };
}

/**
 * Shared shell for the project-creation notification options: derives which
 * sub-controls to show and reports the setup-button impression. The classic
 * (`IssueAlertNotificationOptions`) and SCM (`ScmIssueAlertNotificationOptions`)
 * layouts reuse this and differ only in presentation.
 *
 * @public Consumed by the SCM layout in a downstream PR.
 */
export function useIssueAlertNotificationOptions({
  actions,
  querySuccess,
  shouldRenderSetupButton,
}: IssueAlertNotificationProps) {
  const shouldRenderNotificationConfigs = actions.some(
    v => v !== MultipleCheckboxOptions.EMAIL
  );

  useRouteAnalyticsParams({
    setup_message_integration_button_shown: shouldRenderSetupButton,
  });

  return {
    querySuccess,
    shouldRenderNotificationConfigs,
    shouldRenderSetupButton,
  };
}

export function IssueAlertNotificationOptions(
  notificationProps: IssueAlertNotificationProps
) {
  const {actions, setActions} = notificationProps;
  const organization = useOrganization();
  const {querySuccess, shouldRenderNotificationConfigs, shouldRenderSetupButton} =
    useIssueAlertNotificationOptions(notificationProps);

  if (!querySuccess) {
    return null;
  }

  return (
    <Fragment>
      <MultipleCheckbox
        name="notification"
        value={actions}
        onChange={values => {
          const wasEnabled = actions.includes(MultipleCheckboxOptions.INTEGRATION);
          const isEnabled = values.includes(MultipleCheckboxOptions.INTEGRATION);
          setActions(values);
          if (wasEnabled !== isEnabled) {
            trackAnalytics('project_creation.notify_integration_toggled', {
              organization,
              enabled: isEnabled,
              variant: 'legacy',
            });
          }
        }}
      >
        <Stack gap="md">
          <MultipleCheckbox.Item value={MultipleCheckboxOptions.EMAIL} disabled>
            {t('Notify via email')}
          </MultipleCheckbox.Item>
          {!shouldRenderSetupButton && (
            <div>
              <MultipleCheckbox.Item value={MultipleCheckboxOptions.INTEGRATION}>
                {t('Notify via integration (Slack, Discord, MS Teams, etc.)')}
              </MultipleCheckbox.Item>
              {shouldRenderNotificationConfigs && (
                <MessagingIntegrationAlertRule {...notificationProps} />
              )}
            </div>
          )}
        </Stack>
      </MultipleCheckbox>
      {shouldRenderSetupButton && (
        <SetupMessagingIntegrationButton
          analyticsView={MessagingIntegrationAnalyticsView.PROJECT_CREATION}
          variant="legacy"
        />
      )}
    </Fragment>
  );
}
