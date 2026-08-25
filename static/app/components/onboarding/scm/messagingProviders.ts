import {t} from 'sentry/locale';

/**
 * The curated set of messaging providers for the SCM onboarding messaging
 * step. Slack, Discord, and Microsoft Teams only — PagerDuty and other
 * on-call providers are out of scope for this flow.
 */
export const SCM_MESSAGING_PROVIDER_KEYS = ['slack', 'discord', 'msteams'] as const;

export type ScmMessagingProviderKey = (typeof SCM_MESSAGING_PROVIDER_KEYS)[number];

/**
 * Short description shown in each provider row, per the approved Figma copy.
 */
export const SCM_MESSAGING_PROVIDER_DESCRIPTIONS: Record<
  ScmMessagingProviderKey,
  string
> = {
  slack: t('Get real-time alerts and triage issues without leaving Slack.'),
  msteams: t('Send issue alerts directly to Microsoft Teams.'),
  discord: t('Keep your team updated with issue alerts in Discord.'),
};

/**
 * Tooltip text shown on the info icon in the installable row state.
 */
export const SCM_MESSAGING_PROVIDER_TOOLTIPS: Record<ScmMessagingProviderKey, string> = {
  slack: t('Requires permission to install apps in your Slack workspace.'),
  msteams: t("You'll add Sentry to a team and channel in Microsoft Teams."),
  discord: t('Requires the Manage Server permission.'),
};
