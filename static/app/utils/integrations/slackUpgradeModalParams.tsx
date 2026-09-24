import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';

export function getSlackUpgradeModalParams(
  missingFeatures: OrganizationIntegration['missingFeatures']
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
