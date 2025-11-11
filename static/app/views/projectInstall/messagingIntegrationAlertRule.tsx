import {useMemo} from 'react';
import styled from '@emotion/styled';

import {SelectOption} from '@sentry/scraps/select/option';

import {Select} from 'sentry/components/core/select';
import {components as SelectComponents} from 'sentry/components/forms/controls/reactSelectWrapper';
import FormField from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  providerDetails,
  type IssueAlertNotificationProps,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {useValidateChannel} from 'sentry/views/projectInstall/useValidateChannel';

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

  const validateChannel = useValidateChannel({
    channel,
    integrationId: integration?.id,
    enabled: !!integration?.id && !!channel?.new,
  });

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
              setChannel(undefined);
              validateChannel.clear();
            }}
          />
        ),
        integrationName: (
          <InlineSelectControl
            aria-label={t('integration')}
            disabled={integrationOptions.length === 1}
            value={integration}
            options={integrationOptions}
            onChange={(i: any) => {
              setIntegration(i.value);
              setChannel(undefined);
              validateChannel.clear();
            }}
          />
        ),
        target: (
          <ChannelField name="channel" error={validateChannel.error} inline={false}>
            {() => (
              <InlineSelect
                aria-label={t('channel')}
                placeholder={
                  providerDetails[provider as keyof typeof providerDetails]?.placeholder
                }
                isSearchable
                options={channels?.results.map(ch =>
                  provider === 'slack'
                    ? {
                        label: ch.display,
                        value: ch.display,
                      }
                    : {
                        label: `${ch.display} (${ch.id})`,
                        value: ch.id,
                      }
                )}
                isLoading={isPending || validateChannel.isFetching}
                disabled={!integration}
                value={channel ? {label: channel.label, value: channel.value} : undefined}
                onChange={(
                  option: (SelectValue<string> & {label: string}) | undefined
                ) => {
                  if (option) {
                    setChannel({value: option.value, label: option.label, new: false});
                  } else {
                    setChannel(undefined);
                  }
                  validateChannel.clear();
                }}
                onCreateOption={(newOption: string) => {
                  setChannel({value: newOption, label: newOption, new: true});
                }}
                clearable
                // The Slack API returns the maximum of channels, and users might not find the channel they want in the first 1000.
                // This allows them to add a channel that is not present in the results.
                creatable
                formatCreateLabel={(inputValue: string) => inputValue}
                menuPlacement="auto"
                components={{
                  Option: (
                    optionProps: React.ComponentProps<typeof SelectComponents.Option>
                  ) => {
                    return (
                      <SelectOption
                        {...optionProps}
                        data={{
                          ...optionProps.data,
                          // Hide IconAdd for new channel options by setting __isNew__ to false
                          // We are doing that to don't give the impression that the user can create a new channel.
                          __isNew__: false,
                        }}
                      />
                    );
                  },
                }}
              />
            )}
          </ChannelField>
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

const ChannelField = styled(FormField)`
  padding: 0;
`;
