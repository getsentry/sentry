import {Alert} from '@sentry/scraps/alert';

import {t, tct} from 'sentry/locale';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';

function getPackageNameFromSdkName(sdkName?: string): string | null {
  if (!sdkName) {
    return null;
  }

  if (sdkName.startsWith('sentry.python')) {
    return 'sentry-sdk';
  }

  if (sdkName.startsWith('sentry.javascript.')) {
    const flavor = sdkName.split('.').pop();
    if (flavor) {
      return `@sentry/${flavor}`;
    }
  }

  return null;
}

/**
 * Displays a warning alert when the SDK version is below the minimum required version
 * for agent monitoring.
 */
export function SdkUpdateAlert({
  projectId,
  minVersion,
}: {
  minVersion: string;
  projectId: string;
}) {
  const {needsUpdate, isFetching, isError, data} = useProjectSdkNeedsUpdate({
    minVersion,
    projectId: [projectId],
  });

  if (!needsUpdate || isFetching || isError) {
    return null;
  }

  const sdkUpdate = data?.[0];
  const packageName = getPackageNameFromSdkName(sdkUpdate?.sdkName);

  const suggestedVersion = sdkUpdate?.suggestions?.find(
    suggestion => suggestion.type === 'updateSdk'
  )?.newSdkVersion;

  const firstSentence = packageName
    ? tct('Your [sdkName] version is below the minimum required for agent monitoring.', {
        sdkName: <code>{packageName}</code>,
      })
    : t('Your SDK version is below the minimum required for agent monitoring.');

  const secondSentence = suggestedVersion
    ? tct('Update to [latestVersion] or later.', {
        latestVersion: <code>{suggestedVersion}</code>,
      })
    : t('Update to the latest version.');

  return (
    <Alert variant="warning">
      {firstSentence} {secondSentence}
    </Alert>
  );
}
