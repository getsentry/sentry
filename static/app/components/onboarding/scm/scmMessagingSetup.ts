import type {ScmMessagingProviderKey} from 'sentry/components/onboarding/scm/messagingProviders';
import type {NotificationSelection} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

/**
 * The project created by this onboarding session, with the messaging
 * destination it was created for. Both live in one value so a persisted slug
 * can never be restored without its destination: the messaging step's reuse
 * check compares the staged destination against this snapshot.
 */
export type CreatedProject = {
  /**
   * The destination the project's workflow was created for. `channel` holds
   * the action-target value (`channelTargetedBy`), so equality means the same
   * workflow would be created. Undefined = created email-only (Set up later).
   */
  messagingSelection: NotificationSelection | undefined;
  slug: string;
};

export type ScmMessagingActiveRow = {
  mode: 'configuring' | 'removing';
  providerKey: ScmMessagingProviderKey;
} | null;

export type ScmMessagingSetup =
  | {mode: 'unconfigured'}
  | {mode: 'skipped'}
  | {
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
