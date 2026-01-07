import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';

import {Stack} from '@sentry/scraps/layout';

import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import {useCreateProjectRules} from 'sentry/components/onboarding/useCreateProjectRules';
import {t, tct} from 'sentry/locale';
import {IssueAlertActionType, type IntegrationAction} from 'sentry/types/alerts';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import SetupMessagingIntegrationButton, {
  MessagingIntegrationAnalyticsView,
} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';
import MessagingIntegrationAlertRule from 'sentry/views/projectInstall/messagingIntegrationAlertRule';

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
  label: string;
  value: string;
  new?: boolean;
};

export type IssueAlertNotificationProps = {
  actions: MultipleCheckboxOptions[];
  integration: OrganizationIntegration | undefined;
  provider: string | undefined;
  providersToIntegrations: Record<string, OrganizationIntegration[]>;
  querySuccess: boolean;
  setActions: (action: MultipleCheckboxOptions[]) => void;
  setChannel: (channel?: IntegrationChannel) => void;
  setIntegration: (integration: OrganizationIntegration | undefined) => void;
  setProvider: (provider: string | undefined) => void;
  shouldRenderSetupButton: boolean;
  channel?: IntegrationChannel;
};

export function useCreateNotificationAction({
  actions: defaultActions,
}: Partial<Pick<RequestDataFragment, 'actions'>> = {}) {
  const organization = useOrganization();
  const createProjectRules = useCreateProjectRules();

  const messagingIntegrationsQuery = useApiQuery<OrganizationIntegration[]>(
    [`/organizations/${organization.slug}/integrations/?integrationType=messaging`],
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
  const [shouldRenderSetupButton, setShouldRenderSetupButton] = useState<boolean>(false);

  useEffect(() => {
    // Initializes form state based on the first default action and available integrations.
    // Sets provider, integration, selected actions, and channel if present.
    const firstAction = defaultActions?.[0];
    if (!firstAction) {
      return;
    }

    const matchedProviderKey = Object.keys(providerDetails).find(
      key =>
        providerDetails[key as keyof typeof providerDetails].action === firstAction.id
    );

    const matchedIntegration = matchedProviderKey
      ? providersToIntegrations[matchedProviderKey]?.[0]
      : undefined;

    setProvider(matchedProviderKey);
    setIntegration(matchedIntegration);

    setShouldRenderSetupButton(!matchedIntegration);

    const newActions =
      firstAction.id === IssueAlertActionType.NOTIFY_EMAIL
        ? [MultipleCheckboxOptions.EMAIL]
        : [MultipleCheckboxOptions.EMAIL, MultipleCheckboxOptions.INTEGRATION];

    setActions(newActions);

    if (firstAction.channel) {
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setChannel({
        label: firstAction.channel,
        value: firstAction.channel,
      });
    }
  }, [defaultActions, providersToIntegrations]);

  useEffect(() => {
    if (messagingIntegrationsQuery.isSuccess) {
      const providerKeys = Object.keys(providersToIntegrations);
      const firstProvider = providerKeys[0];
      const firstIntegration = providersToIntegrations[String(firstProvider)]?.[0];
      setProvider(firstProvider);
      setIntegration(firstIntegration);
      setShouldRenderSetupButton(!firstProvider);
    }
  }, [messagingIntegrationsQuery.isSuccess, providersToIntegrations]);

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
        return undefined;
      }

      let integrationAction: IntegrationAction;
      switch (provider) {
        case 'slack':
          integrationAction = {
            id: IssueAlertActionType.SLACK,
            workspace: integration?.id,
            channel: channel?.value,
          };

          break;
        case 'discord':
          integrationAction = {
            id: IssueAlertActionType.DISCORD,
            server: integration?.id,
            channel_id: channel?.value,
          };

          break;
        case 'msteams':
          integrationAction = {
            id: IssueAlertActionType.MS_TEAMS,
            team: integration?.id,
            channel: channel?.value,
          };
          break;
        default:
          return undefined;
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
      querySuccess: messagingIntegrationsQuery.isSuccess,
      shouldRenderSetupButton,
    },
  };
}

export default function IssueAlertNotificationOptions(
  notificationProps: IssueAlertNotificationProps
) {
  const {actions, setActions, querySuccess, shouldRenderSetupButton} = notificationProps;

  const shouldRenderNotificationConfigs = actions.some(
    v => v !== MultipleCheckboxOptions.EMAIL
  );

  useRouteAnalyticsParams({
    setup_message_integration_button_shown: shouldRenderSetupButton,
  });

  if (!querySuccess) {
    return null;
  }

  return (
    <Fragment>
      <MultipleCheckbox
        name="notification"
        value={actions}
        onChange={values => setActions(values)}
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
        />
      )}
    </Fragment>
  );
}
