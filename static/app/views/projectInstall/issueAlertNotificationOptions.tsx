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
import {
  MessagingIntegrationAnalyticsView,
  SetupMessagingIntegrationButton,
} from 'sentry/components/messagingIntegrations/setupMessagingIntegrationButton';
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
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';
import {MessagingIntegrationAlertRule} from 'sentry/views/projectInstall/messagingIntegrationAlertRule';

type ChannelIdentityField = 'channelId' | 'channelName';

interface MessagingProviderDetail {
  action: IssueAlertActionType;
  channelSelectedBy: ChannelIdentityField;
  channelTargetedBy: ChannelIdentityField;
  channelValidatedBy: ChannelIdentityField;
  makeSentence: (args: any) => ReactNode;
  name: string;
  placeholder: string;
}

/**
 * Maps a stored destination field onto its counterpart in the raw `/channels/`
 * response, so a stored value can be matched back to a channel.
 */
export const RAW_CHANNEL_FIELD = {
  channelName: 'display',
  channelId: 'id',
} as const satisfies Record<ChannelIdentityField, 'display' | 'id'>;

/**
 * Providers disagree on what identifies a channel. MS Teams is the only row
 * that is not uniform: it validates by name but is addressed by id, because
 * Sentry built a name-to-id resolver for it while all three send by id.
 */
export const providerDetails = {
  slack: {
    name: t('Slack'),
    action: IssueAlertActionType.SLACK,
    placeholder: t('channel, e.g. #critical'),
    channelSelectedBy: 'channelName',
    channelValidatedBy: 'channelName',
    channelTargetedBy: 'channelName',
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
    channelSelectedBy: 'channelId',
    channelValidatedBy: 'channelId',
    channelTargetedBy: 'channelId',
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
    channelSelectedBy: 'channelId',
    channelValidatedBy: 'channelName',
    channelTargetedBy: 'channelId',
    makeSentence: ({providerName, integrationName, target}: any) =>
      tct('Send [providerName] notification to the [integrationName] team to [target]', {
        providerName,
        integrationName,
        target,
      }),
  },
} satisfies Record<string, MessagingProviderDetail>;

type MessagingProviderKey = keyof typeof providerDetails;

/**
 * Defaults to `channelId` for an unrecognized provider, preserving the prior
 * inline conditional that singled out Slack and treated everything else as
 * id-keyed.
 */
export function getChannelSelectedBy(provider: string | undefined): ChannelIdentityField {
  return (
    providerDetails[provider as MessagingProviderKey]?.channelSelectedBy ?? 'channelId'
  );
}

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
 */
function buildIntegrationAction({
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

export type NotificationSelection = {
  channel: string;
  integrationId: string;
  provider: string;
};

/**
 * Builds the raw {provider, integrationId, channel} snapshot of the current
 * messaging selection. Returns undefined if any of the three fields are absent.
 */
export function buildNotificationSelection({
  provider,
  integration,
  channel,
}: Pick<IssueAlertNotificationProps, 'provider' | 'integration' | 'channel'>):
  | NotificationSelection
  | undefined {
  if (!provider || !integration || !channel?.value) {
    return undefined;
  }
  return {provider, integrationId: integration.id, channel: channel.value};
}

/**
 * Result of resolving the initial notification-picker selection, computed
 * from whatever restore source a caller-specific hook uses (a persisted
 * rule action, a raw stored selection, etc).
 */
type RestoreOutcome =
  | {kind: 'auto'}
  | {kind: 'wait'}
  | {
      actions: MultipleCheckboxOptions[];
      channel: IntegrationChannel | undefined;
      integration: OrganizationIntegration | undefined;
      kind: 'apply';
      provider: string | undefined;
      shouldRenderSetupButton: boolean;
    };

type RestoreResolver = (
  providersToIntegrations: Record<string, OrganizationIntegration[]>
) => RestoreOutcome;

/**
 * Flow-agnostic base for the messaging-integration notification picker: owns
 * the integrations query, picker state, the once-only restore/auto-select
 * effect, and the create-rule side effect. Callers only supply how to
 * resolve the initial selection via `resolveRestore`.
 */
function useNotificationPicker(resolveRestore: RestoreResolver) {
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

  // Seeds the notification picker once, after the integrations query resolves:
  // restores the selection via `resolveRestore` when it can, otherwise
  // auto-selects the first available integration. Guarded by a ref so it runs
  // a single time and never overwrites later user edits.
  useEffect(() => {
    if (!messagingIntegrationsQuery.isSuccess || hasInitializedSelection.current) {
      return;
    }

    const outcome = resolveRestore(providersToIntegrations);

    if (outcome.kind === 'wait') {
      // The restore source names an integration that hasn't loaded yet: show
      // the setup CTA and do NOT latch, so this effect re-runs after a
      // refetch delivers it. Don't half-apply the restore, so the picker
      // can't look submittable with an unresolved integration.
      setShouldRenderSetupButton(true);
      return;
    }

    if (outcome.kind === 'apply') {
      setProvider(outcome.provider);
      setIntegration(outcome.integration);
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setActions(outcome.actions);
      setShouldRenderSetupButton(outcome.shouldRenderSetupButton);
      if (outcome.channel) {
        setChannel(outcome.channel);
      }
      hasInitializedSelection.current = true;
      return;
    }

    // No restore source: auto-select the first available provider/integration.
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
  }, [messagingIntegrationsQuery.isSuccess, providersToIntegrations, resolveRestore]);

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

/**
 * Classic notification-picker adapter: restores the selection by decoding a
 * persisted `IssueAlertRuleAction` (e.g. from a previously created rule, in
 * the API's flattened action shape). Used by the standalone Create Project
 * page, whose only restore source is a real created rule.
 */
export function useCreateNotificationAction({
  actions: defaultActions,
}: Partial<Pick<RequestDataFragment, 'actions'>> = {}) {
  const resolveRestore = useCallback<RestoreResolver>(
    providersToIntegrations => {
      const firstAction = defaultActions?.[0];
      if (!firstAction) {
        return {kind: 'auto'};
      }

      // Provider key is derived from the action's id; integration is matched
      // by integrationId if present, falling back to the first in the list.
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

      const isIntegrationAction = firstAction.id !== IssueAlertActionType.NOTIFY_EMAIL;
      if (isIntegrationAction && !matchedIntegration) {
        return {kind: 'wait'};
      }

      const restoredChannel = firstAction.channel ?? firstAction.channel_id;

      return {
        kind: 'apply',
        provider: matchedProviderKey,
        integration: matchedIntegration,
        channel: restoredChannel
          ? {label: restoredChannel, value: restoredChannel}
          : undefined,
        actions: isIntegrationAction
          ? [MultipleCheckboxOptions.EMAIL, MultipleCheckboxOptions.INTEGRATION]
          : [MultipleCheckboxOptions.EMAIL],
        shouldRenderSetupButton: !matchedIntegration,
      };
    },
    [defaultActions]
  );

  return useNotificationPicker(resolveRestore);
}

/**
 * SCM notification-picker adapter: restores the selection directly from raw
 * `provider`/`integrationId`/`channel` fields (e.g. persisted in the SCM
 * wizard's own session storage), with no decoding step.
 */
export function useScmNotificationAction({
  provider,
  integrationId,
  channel,
}: Partial<NotificationSelection> = {}) {
  const resolveRestore = useCallback<RestoreResolver>(
    providersToIntegrations => {
      // A stored selection always carries an integrationId (the encoder bails
      // without one); anything less is treated as no selection at all.
      if (!provider || !integrationId) {
        return {kind: 'auto'};
      }

      const matchedIntegration = providersToIntegrations[provider]?.find(
        i => i.id === integrationId
      );

      // Named integration not (yet) in the query response: show the setup CTA
      // and don't latch, so this re-resolves after a refetch delivers it
      // (mirrors the classic decode resolver's guard).
      if (!matchedIntegration) {
        return {kind: 'wait'};
      }

      return {
        kind: 'apply',
        provider,
        integration: matchedIntegration,
        channel: channel ? {label: channel, value: channel} : undefined,
        actions: [MultipleCheckboxOptions.EMAIL, MultipleCheckboxOptions.INTEGRATION],
        shouldRenderSetupButton: false,
      };
    },
    [provider, integrationId, channel]
  );

  return useNotificationPicker(resolveRestore);
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
