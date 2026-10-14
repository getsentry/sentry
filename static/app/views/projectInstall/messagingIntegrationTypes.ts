import type {ReactNode} from 'react';

import {t, tct} from 'sentry/locale';
import {
  IssueAlertActionType,
  type IntegrationAction,
} from 'sentry/types/alerts';
import type {OrganizationIntegration} from 'sentry/types/integrations';

export type ChannelIdentityField = 'channelId' | 'channelName';

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
 * Providers disagree on what identifies a channel. Slack and MS Teams resolve
 * a channel by name (`find_channel_id` matches Teams channels by name only),
 * Discord by id. Each picker is keyed by the field its backend resolves, so a
 * picked channel and its action target are the same value. A Slack action
 * also carries the id of a channel picked from the list (see
 * `buildIntegrationAction`).
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
    placeholder: t('channel, e.g. General'),
    channelSelectedBy: 'channelName',
    channelValidatedBy: 'channelName',
    channelTargetedBy: 'channelName',
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

/**
 * The value an action carries for a channel: the field the provider's backend
 * resolves (`channelTargetedBy`) when the channel carries both identifiers,
 * else `value`, which for a typed channel or one restored from an action
 * target already is the target.
 */
export function getChannelTarget(
  provider: string | undefined,
  channel: IntegrationChannel | undefined
): string | undefined {
  if (!channel) {
    return undefined;
  }
  const targetedBy = providerDetails[provider as MessagingProviderKey]?.channelTargetedBy;
  return (targetedBy && channel[targetedBy]) || channel.value;
}

export const enum MultipleCheckboxOptions {
  EMAIL = 'email',
  INTEGRATION = 'integration',
}

export type IntegrationChannel = {
  label: ReactNode;
  /** The picker key: the field named by the provider's `channelSelectedBy`. */
  value: string;
  /**
   * Both identifiers, when the channel was resolved from the `/channels/` list
   * or seeded from a saved destination. Absent for a typed channel and for one
   * restored from an action target alone, whose `value` already is the target.
   */
  channelId?: string;
  channelName?: string;
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

export type NotificationSelection = {
  /** The action target for the channel (see `getChannelTarget`). */
  channel: string;
  integrationId: string;
  provider: string;
};

/**
 * Builds the serializable IntegrationAction for a messaging selection.
 * Returns undefined if any required selection field is absent or the provider
 * is not recognized.
 *
 * `channelId` is the id of a channel picked from the `/channels/` list. Slack
 * checks a channel by id when the action has one, because its lookup by name
 * does not find some channels the list returns.
 */
export function buildIntegrationAction({
  provider,
  integrationId,
  channel,
  channelId,
}: Partial<NotificationSelection> & {channelId?: string}): IntegrationAction | undefined {
  if (!provider || !integrationId || !channel) {
    return undefined;
  }

  switch (provider) {
    case 'slack':
      return {
        id: IssueAlertActionType.SLACK,
        workspace: integrationId,
        channel,
        channel_id: channelId,
      };
    case 'discord':
      return {
        id: IssueAlertActionType.DISCORD,
        server: integrationId,
        channel_id: channel,
      };
    case 'msteams':
      return {
        id: IssueAlertActionType.MS_TEAMS,
        team: integrationId,
        channel,
      };
    default:
      return undefined;
  }
}

/**
 * Builds the raw {provider, integrationId, channel} snapshot of the current
 * messaging selection, with `channel` as the action target. Returns undefined
 * if any of the three fields are absent.
 */
export function buildNotificationSelection({
  provider,
  integration,
  channel,
}: Pick<IssueAlertNotificationProps, 'provider' | 'integration' | 'channel'>):
  | NotificationSelection
  | undefined {
  const target = getChannelTarget(provider, channel);
  if (!provider || !integration || !target) {
    return undefined;
  }
  return {provider, integrationId: integration.id, channel: target};
}
