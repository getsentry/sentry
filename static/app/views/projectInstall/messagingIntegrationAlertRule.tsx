import {useMemo} from 'react';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import Input from 'sentry/components/input';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type IssueAlertNotificationProps,
  providerDetails,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

export default function MessagingIntegrationAlertRule({
  channel,
  integration,
  provider,
  setChannel,
  setIntegration,
  setProvider,
  providersToIntegrations,
}: IssueAlertNotificationProps) {
  const providerOptions = useMemo(
    () =>
      Object.keys(providersToIntegrations).map(p => ({
        value: p,
        label: providerDetails[p as keyof typeof providerDetails].name,
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

  if (!provider) {
    return null;
  }

  return (
    <Rule>
      {providerDetails[provider as keyof typeof providerDetails]?.makeSentence({
        providerName: (
          <InlineSelectControl
            aria-label={t('provider')}
            disabled={Object.keys(providersToIntegrations).length === 1}
            value={provider}
            options={providerOptions}
            onChange={(p: any) => {
              setProvider(p.value);
              setIntegration(providersToIntegrations[p.value]![0]!);
              setChannel('');
            }}
          />
        ),
        integrationName: (
          <InlineSelectControl
            aria-label={t('integration')}
            disabled={integrationOptions.length === 1}
            value={integration}
            options={integrationOptions}
            onChange={(i: any) => setIntegration(i.value)}
          />
        ),
        target: (
          <InlineInput
            aria-label={t('channel')}
            type="text"
            value={channel || ''}
            placeholder={
              providerDetails[provider as keyof typeof providerDetails]?.placeholder
            }
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setChannel(e.target.value)
            }
          />
        ),
      })}
    </Rule>
  );
}

const Rule = styled('div')`
  padding: ${space(1)};
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
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
