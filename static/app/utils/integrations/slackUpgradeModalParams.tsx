import {t} from 'sentry/locale';

// Slack has one upgrade prompt, shared by the Seer nudge and settings buttons.
export function getSlackUpgradeModalParams() {
  return {
    title: t('Update Slack App Permissions'),
    description: t(
      'Seer needs additional Slack app permissions to respond when you mention @Sentry and read conversation context to help investigate issues. Reauthorize the Sentry app in your Slack workspace and accept the updated permissions to ask questions and debug with Seer directly in Slack.'
    ),
  };
}
