import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export function getSlackUpgradeModalParams(
  missingFeatures: Array<{description: string; key: string}> | null | undefined
) {
  const instructions = t(
    'Reauthorize the Sentry app in your Slack workspace and accept the updated permissions to continue.'
  );

  return {
    title: t('Update Slack App Permissions'),
    description: missingFeatures?.length ? (
      <Stack gap="lg">
        <Text>
          {t('This workspace is missing permissions for the following features:')}
        </Text>
        <Stack as="ul" gap="sm" paddingLeft="xl">
          {missingFeatures.map(feature => (
            <li key={feature.key}>
              <Text>{feature.description}</Text>
            </li>
          ))}
        </Stack>
        <Text>{instructions}</Text>
      </Stack>
    ) : (
      instructions
    ),
  };
}
