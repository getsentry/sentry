import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import {space} from 'sentry/styles/space';
import {IssueAlertActionType} from 'sentry/types/alerts';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import SetupMessagingIntegrationButton, {
  MessagingIntegrationAnalyticsView,
} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';
import {useIssueAlertNotificationContext} from 'sentry/views/projectInstall/issueAlertNotificationContext';
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

enum MultipleCheckboxOptions {
  EMAIL = 'email',
  INTEGRATION = 'integration',
}

export default function IssueAlertNotificationOptions() {
  const organization = useOrganization();
  const {
    alertNotificationAction: action,
    alertNotificationProvider: provider,
    setAlertNotificationAction: setAction,
    setAlertNotificationIntegration: setIntegration,
    setAlertNotificationProvider: setProvider,
  } = useIssueAlertNotificationContext();
  const [selectedValues, setSelectedValues] = useState<MultipleCheckboxOptions[]>(
    action.map(a =>
      a === IssueAlertActionType.NOTIFY_EMAIL
        ? MultipleCheckboxOptions.EMAIL
        : MultipleCheckboxOptions.INTEGRATION
    )
  );

  const messagingIntegrationsQuery = useApiQuery<OrganizationIntegration[]>(
    [`/organizations/${organization.slug}/integrations/?integrationType=messaging`],
    {staleTime: Infinity}
  );

  const refetchConfigs = () => messagingIntegrationsQuery.refetch();

  const providersToIntegrations = useMemo(() => {
    const map: {[key: string]: OrganizationIntegration[]} = {};
    if (!messagingIntegrationsQuery.data) {
      return {};
    }
    for (const i of messagingIntegrationsQuery.data) {
      const providerSlug = i.provider.slug;
      map[providerSlug] = map[providerSlug] ?? [];
      map[providerSlug].push(i);
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
    return selectedValues.some(v => v !== MultipleCheckboxOptions.EMAIL);
  }, [selectedValues]);

  const onChange = values => {
    setSelectedValues(values);
    setAction(
      values.map(v =>
        v === MultipleCheckboxOptions.INTEGRATION && provider
          ? providerDetails[provider].action
          : IssueAlertActionType.NOTIFY_EMAIL
      )
    );
  };

  if (messagingIntegrationsQuery.isLoading || messagingIntegrationsQuery.isError) {
    return null;
  }

  return (
    <div>
      <MultipleCheckbox name="notification" value={selectedValues} onChange={onChange}>
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
                  providersToIntegrations={providersToIntegrations}
                />
              )}
            </div>
          )}
        </Wrapper>
      </MultipleCheckbox>
      {shouldRenderSetupButton && (
        <SetupMessagingIntegrationButton
          refetchConfigs={refetchConfigs}
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
