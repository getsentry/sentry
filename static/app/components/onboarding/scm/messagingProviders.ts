import {t} from 'sentry/locale';

/**
 * The curated set of messaging providers for the SCM onboarding messaging
 * step. Single source of truth for the launch set approved in VDY-138:
 * Slack, Discord, and Microsoft Teams. PagerDuty and other on-call providers
 * are out of scope.
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
