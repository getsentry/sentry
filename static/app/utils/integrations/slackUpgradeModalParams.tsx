import {t} from 'sentry/locale';

export function getSlackUpgradeModalParams(
  missingFeatures: Array<{description: string; key: string}> | null | undefined
) {
  const instructions = t(
    'Reauthorize the Sentry app in your Slack workspace and accept the updated permissions to continue.'
  );

  return {
    title: t('Update Slack App Permissions'),
    description: missingFeatures?.length
      ? [
          t('This workspace is missing permissions for the following features:'),
          ...missingFeatures.map(feature => feature.description),
          instructions,
        ].join(' ')
      : instructions,
  };
}
