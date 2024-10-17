import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import type {Client} from 'sentry/api';
import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import {space} from 'sentry/styles/space';
import {IssueAlertActionType} from 'sentry/types/alerts';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import SetupMessagingIntegrationButton, {
  MessagingIntegrationAnalyticsView,
} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';
import MessagingIntegrationAlertRule from 'sentry/views/projectInstall/messagingIntegrationAlertRule';

export const providerDetails = {
  slack: {
    name: 'Slack',
    action: IssueAlertActionType.SLACK,
    label: 'workspace to',
    placeholder: 'channel, e.g. #critical',
  },
  discord: {
    name: 'Discord',
    action: IssueAlertActionType.DISCORD,
    label: 'server in the channel',
    placeholder: 'channel ID or URL',
  },
  msteams: {
    name: 'MSTeams',
    action: IssueAlertActionType.MS_TEAMS,
    label: 'team to',
    placeholder: 'channel ID',
  },
};

export const enum MultipleCheckboxOptions {
  EMAIL = 'email',
  INTEGRATION = 'integration',
}

export type IssueAlertNotificationProps = {
  actions: MultipleCheckboxOptions[];
  channel: string | undefined;
  integration: OrganizationIntegration | undefined;
  provider: string | undefined;
  setActions: (action: MultipleCheckboxOptions[]) => void;
  setChannel: (channel: string | undefined) => void;
  setIntegration: (integration: OrganizationIntegration | undefined) => void;
  setProvider: (provider: string | undefined) => void;
};

export function useCreateNotificationAction() {
  const [actions, setActions] = useState<MultipleCheckboxOptions[]>([
    MultipleCheckboxOptions.EMAIL,
  ]);
  const [provider, setProvider] = useState<string | undefined>(undefined);
  const [integration, setIntegration] = useState<OrganizationIntegration | undefined>(
    undefined
  );
  const [channel, setChannel] = useState<string | undefined>(undefined);

  const integrationAction = useMemo(() => {
    const isCreatingIntegrationNotification = actions.find(
      action => action === MultipleCheckboxOptions.INTEGRATION
    );
    if (!isCreatingIntegrationNotification) {
      return undefined;
    }
    switch (provider) {
      case 'slack':
        return [
          {
            id: IssueAlertActionType.SLACK,
            workspace: integration?.id,
            channel: channel,
          },
        ];
      case 'discord':
        return [
          {
            id: IssueAlertActionType.DISCORD,
            server: integration?.id,
            channel_id: channel,
          },
        ];
      case 'msteams':
        return [
          {
            id: IssueAlertActionType.MS_TEAMS,
            team: integration?.id,
            channel: channel,
          },
        ];
      default:
        return undefined;
    }
  }, [actions, integration, channel, provider]);

  type Props = {
    actionMatch: string | undefined;
    api: Client;
    conditions: {id: string; interval: string; value: string}[] | undefined;
    frequency: number | undefined;
    name: string | undefined;
    organizationSlug: string;
    projectSlug: string;
  };

  const createNotificationAction = useCallback(
    ({
      api,
      organizationSlug,
      projectSlug,
      name,
      conditions,
      actionMatch,
      frequency,
    }: Props) => {
      if (!integrationAction) {
        return null;
      }
      return api.requestPromise(`/projects/${organizationSlug}/${projectSlug}/rules/`, {
        method: 'POST',
        data: {
          name,
          conditions,
          actions: integrationAction,
          actionMatch,
          frequency,
        },
      });
    },
    [integrationAction]
  );

  return {
    createNotificationAction,
    actions,
    provider,
    integration,
    channel,
    setActions,
    setProvider,
    setIntegration,
    setChannel,
  };
}

export default function IssueAlertNotificationOptions(
  notificationProps: IssueAlertNotificationProps
) {
  const organization = useOrganization();
  const {actions, provider, setActions, setIntegration, setProvider} = notificationProps;

  const messagingIntegrationsQuery = useApiQuery<OrganizationIntegration[]>(
    [`/organizations/${organization.slug}/integrations/?integrationType=messaging`],
    {staleTime: Infinity}
  );

  const providersToIntegrations = useMemo(() => {
    const map: {[key: string]: OrganizationIntegration[]} = {};
    if (messagingIntegrationsQuery.data) {
      for (const i of messagingIntegrationsQuery.data) {
        const providerSlug = i.provider.slug;
        map[providerSlug] = map[providerSlug] ?? [];
        map[providerSlug].push(i);
      }
    }
    return map;
  }, [messagingIntegrationsQuery.data]);

  useEffect(() => {
    const providerKeys = Object.keys(providersToIntegrations);
    if (providerKeys.length > 0) {
      const firstProvider = providerKeys[0];
      setProvider(firstProvider);

      const firstIntegration = providersToIntegrations[firstProvider][0];
      setIntegration(firstIntegration);
    }
  }, [providersToIntegrations, setProvider, setIntegration]);

  const shouldRenderSetupButton = useMemo(() => {
    return messagingIntegrationsQuery.data?.every(i => i.status !== 'active');
  }, [messagingIntegrationsQuery.data]);

  const shouldRenderNotificationConfigs = useMemo(() => {
    return actions.some(v => v !== MultipleCheckboxOptions.EMAIL);
  }, [actions]);

  if (messagingIntegrationsQuery.isLoading || messagingIntegrationsQuery.isError) {
    return null;
  }

  return (
    <div>
      <MultipleCheckbox
        name="notification"
        value={actions}
        onChange={values => setActions(values)}
      >
        <Wrapper>
          <MultipleCheckbox.Item value={MultipleCheckboxOptions.EMAIL} disabled>
            Notify via email
          </MultipleCheckbox.Item>
          {!shouldRenderSetupButton && provider && (
            <div>
              <MultipleCheckbox.Item value={MultipleCheckboxOptions.INTEGRATION}>
                Notify via integration (Slack, Discord, MS Teams, etc.)
              </MultipleCheckbox.Item>
              {shouldRenderNotificationConfigs && (
                <MessagingIntegrationAlertRule
                  notificationProps={notificationProps}
                  providersToIntegrations={providersToIntegrations}
                />
              )}
            </div>
          )}
        </Wrapper>
      </MultipleCheckbox>
      {shouldRenderSetupButton && (
        <SetupMessagingIntegrationButton
          refetchConfigs={messagingIntegrationsQuery.refetch}
          analyticsParams={{
            view: MessagingIntegrationAnalyticsView.ALERT_RULE_CREATION,
          }}
        />
      )}
    </div>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
