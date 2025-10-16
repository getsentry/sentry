import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  providerDetails,
  type IssueAlertNotificationProps,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

type Channel = {
  display: string;
  id: string;
  name: string;
  type: string;
};

type ChannelListResponse = {
  results: Channel[];
};

export default function MessagingIntegrationAlertRule({
  channel,
  integration,
  provider,
  setChannel,
  setIntegration,
  setProvider,
  providersToIntegrations,
}: IssueAlertNotificationProps) {
  const organization = useOrganization();

  const {data: channels, isPending} = useApiQuery<ChannelListResponse>(
    [`/organizations/${organization.slug}/integrations/${integration?.id}/channels/`],
    {
      staleTime: Infinity,
      enabled: !!provider && !!integration?.id,
    }
  );

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
              setIntegration(providersToIntegrations[p.value]![0]);
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
          <InlineSelect
            aria-label={t('channel')}
            placeholder={
              providerDetails[provider as keyof typeof providerDetails]?.placeholder
            }
            isSearchable
            options={channels?.results.map(ch => ({
              label: ch.display,
              value: ch.display,
            }))}
            isLoading={isPending}
            disabled={!integration}
            value={channel ? {label: channel, value: channel} : undefined}
            onChange={(option: SelectValue<string> | undefined) =>
              setChannel(option?.value)
            }
            clearable
            // The Slack API returns the maximum of channels, and users might not find the channel they want in the first 1000.
            // This allows them to add a channel that is not present in the results.
            creatable
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
  flex-wrap: wrap;
  align-items: center;
  gap: ${space(1)};
`;

const InlineSelectControl = styled(Select)`
  width: 180px;
`;

const InlineSelect = styled(Select)`
  min-width: 220px;
`;
