import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';

import {t} from 'sentry/locale';
import {
  type IssueAlertNotificationProps,
  providerDetails,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  ChannelField,
  ChannelSelect,
  useMessagingIntegrationAlertRule,
} from 'sentry/views/projectInstall/messagingIntegrationAlertRule';

/**
 * SCM-styled variant of `MessagingIntegrationAlertRule`. Instead of the classic
 * inline sentence inside a grey card, the provider sentence is rendered into a
 * flex column: each input is its own flex item and each contiguous run of text
 * becomes an anonymous flex item, so every text block and input lands on its
 * own full-width row in `makeSentence`'s order. Letting the column do the
 * splitting (rather than parsing the sentence) keeps it correct no matter how a
 * translation reorders the placeholders.
 *
 * Reuses `useMessagingIntegrationAlertRule` (the channel query, validation, and
 * option lists) and the same provider sentence as the classic layout, so copy
 * and behavior stay in lockstep; only the presentation differs.
 */
export function ScmMessagingIntegrationAlertRule(props: IssueAlertNotificationProps) {
  const {
    provider,
    integration,
    channel,
    providerOptions,
    integrationOptions,
    channelOptions,
    isChannelLoading,
    channelError,
    providerDisabled,
    integrationDisabled,
    onProviderChange,
    onIntegrationChange,
    onChannelChange,
    onCreateChannel,
  } = useMessagingIntegrationAlertRule(props);

  if (!provider) {
    return null;
  }

  return (
    <Stack gap="md">
      {providerDetails[provider as keyof typeof providerDetails]?.makeSentence({
        providerName: (
          <FullWidthSelect
            aria-label={t('provider')}
            disabled={providerDisabled}
            value={provider}
            options={providerOptions}
            onChange={onProviderChange}
          />
        ),
        integrationName: (
          <FullWidthSelect
            aria-label={t('integration')}
            disabled={integrationDisabled}
            value={integration}
            options={integrationOptions}
            onChange={onIntegrationChange}
          />
        ),
        target: (
          // flexibleControlStateSize collapses the (empty) control-state column
          // that otherwise reserves a fixed 24px, so the full-width select can
          // fill the row.
          <ChannelField
            name="channel"
            error={channelError}
            inline={false}
            flexibleControlStateSize
          >
            {() => (
              <FullWidthChannelSelect
                provider={provider}
                options={channelOptions}
                value={channel}
                isLoading={isChannelLoading}
                disabled={!integration}
                onChange={onChannelChange}
                onCreateOption={onCreateChannel}
              />
            )}
          </ChannelField>
        ),
      })}
    </Stack>
  );
}

const FullWidthSelect = styled(Select)`
  width: 100%;
`;

const FullWidthChannelSelect = styled(ChannelSelect)`
  width: 100%;
`;
