import type {ScmMessagingProviderKey} from 'sentry/components/onboarding/scm/messagingProviders';

export type {ScmMessagingProviderKey};

export type ScmMessagingSetup =
  | {mode: 'unconfigured'}
  | {mode: 'skipped'}
  | {
      /**
       * The value written into the alert rule action payload.
       * Slack: display name (e.g. "#general") — Slack actions address by name.
       * Discord: channel ID — Discord actions address by ID.
       * msteams: channel ID — msteams actions address by ID.
       */
      actionTarget: string;
      /**
       * The real backend channel ID for all providers (e.g. C123 for Slack,
       * a numeric string for Discord, a UUID-like string for msteams).
       * Used as the Discord channel-validate param and as the Discord action value.
       */
      channelId: string;
      /**
       * Human-readable display name shown in the UI.
       * Also the channel-validate param for Slack and msteams, which both
       * resolve channels by name rather than ID.
       */
      channelName: string;
      integrationId: string;
      mode: 'selected';
      providerKey: ScmMessagingProviderKey;
    };

export const UNCONFIGURED_SCM_MESSAGING_SETUP = {
  mode: 'unconfigured',
} as const satisfies ScmMessagingSetup;
