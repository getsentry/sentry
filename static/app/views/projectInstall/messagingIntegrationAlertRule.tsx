import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import Input from 'sentry/components/input';
// import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {
  type IssueAlertNotificationProps,
  providerDetails,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

type Props = {
  notificationProps: IssueAlertNotificationProps;
  providersToIntegrations: Record<string, OrganizationIntegration[]>;
};

export default function MessagingIntegrationAlertRule({
  notificationProps,
  providersToIntegrations,
}: Props) {
  const {channel, integration, provider, setChannel, setIntegration, setProvider} =
    notificationProps;

  const providerOptions = useMemo(
    () =>
      Object.keys(providersToIntegrations).map(p => ({
        value: p,
        label: providerDetails[p].name,
      })),
    [providersToIntegrations]
  );
  const integrationOptions = useMemo(
    () =>
      provider && providersToIntegrations[provider]
        ? providersToIntegrations[provider]?.map(i => ({
            value: i,
            label: i.name,
          }))
        : [],
    [providersToIntegrations, provider]
  );

  useEffect(() => {
    const providerKeys = Object.keys(providersToIntegrations);
    if (providerKeys.length > 0) {
      const firstProvider = providerKeys[0];
      setProvider(firstProvider);

      const firstIntegration = providersToIntegrations[firstProvider][0];
      setIntegration(firstIntegration);
    }
  }, [providersToIntegrations, setProvider, setIntegration]);

  if (!provider) {
    return null;
  }

  return (
    <RuleWrapper>
      <Rule>
        {providerDetails[provider]?.makeSentence({
          providerName: (
            <InlineSelectControl
              aria-label="provider"
              disabled={Object.keys(providersToIntegrations).length === 1}
              value={provider}
              options={providerOptions}
              onChange={p => {
                setProvider(p.value);
                setIntegration(providersToIntegrations[p.value][0]);
                setChannel('');
              }}
            />
          ),
          integrationName: (
            <InlineSelectControl
              aria-label="integration"
              disabled={integrationOptions.length === 1}
              value={integration}
              options={integrationOptions}
              onChange={i => setIntegration(i.value)}
            />
          ),
          target: (
            <InlineInput
              aria-label="channel"
              type="text"
              value={channel || ''}
              placeholder={providerDetails[provider]?.placeholder}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setChannel(e.target.value)
              }
            />
          ),
        })}
      </Rule>
    </RuleWrapper>
  );
}

const RuleWrapper = styled('div')`
  padding: ${space(1)};
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
`;

const Rule = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const InlineSelectControl = styled(SelectControl)`
  width: 180px;
`;

const InlineInput = styled(Input)`
  width: auto;
  min-height: 28px;
`;
