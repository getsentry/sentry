import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {type IntegrationAction, IssueAlertActionType} from 'sentry/types/alerts';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import SetupMessagingIntegrationButton, {
  MessagingIntegrationAnalyticsView,
} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';
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

export type IssueAlertNotificationProps = {
  actions: MultipleCheckboxOptions[];
  channel: string | undefined;
  integration: OrganizationIntegration | undefined;
  provider: string | undefined;
  providersToIntegrations: Record<string, OrganizationIntegration[]>;
  querySuccess: boolean;
  setActions: (action: MultipleCheckboxOptions[]) => void;
  setChannel: (channel: string | undefined) => void;
  setIntegration: (integration: OrganizationIntegration | undefined) => void;
  setProvider: (provider: string | undefined) => void;
  shouldRenderSetupButton: boolean;
};

export function useCreateNotificationAction() {
  const api = useApi();
  const organization = useOrganization();

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
  const [channel, setChannel] = useState<string | undefined>(undefined);
  const [shouldRenderSetupButton, setShouldRenderSetupButton] = useState<boolean>(false);

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

  type Props = {
    actionMatch: string | undefined;
    conditions: {id: string; interval: string; value: string}[] | undefined;
    frequency: number | undefined;
    name: string | undefined;
    projectSlug: string;
    shouldCreateRule: boolean | undefined;
  };

  const createNotificationAction = useCallback(
    ({
      shouldCreateRule,
      projectSlug,
      name,
      conditions,
      actionMatch,
      frequency,
    }: Props) => {
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
            channel,
          };

          break;
        case 'discord':
          integrationAction = {
            id: IssueAlertActionType.DISCORD,
            server: integration?.id,
            channel_id: channel,
          };

          break;
        case 'msteams':
          integrationAction = {
            id: IssueAlertActionType.MS_TEAMS,
            team: integration?.id,
            channel,
          };
          break;
        default:
          return undefined;
      }

      return api.requestPromise(`/projects/${organization.slug}/${projectSlug}/rules/`, {
        method: 'POST',
        data: {
          name,
          conditions,
          actions: [integrationAction],
          actionMatch,
          frequency,
        },
      });
    },
    [actions, api, provider, integration, channel, organization.slug]
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
        <Wrapper>
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
        </Wrapper>
      </MultipleCheckbox>
      {shouldRenderSetupButton && (
        <SetupMessagingIntegrationButton
          analyticsView={MessagingIntegrationAnalyticsView.PROJECT_CREATION}
        />
      )}
    </Fragment>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
