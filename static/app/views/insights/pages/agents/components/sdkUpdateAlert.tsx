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
    ? tct(
        "We've detected you're using [sdkName] below the minimum required version for agent monitoring to work.",
        {
          sdkName: <code>{packageName}</code>,
        }
      )
    : t(
        "We've detected you're using an SDK below the minimum required version for agent monitoring to work."
      );

  const secondSentence = suggestedVersion
    ? tct('Update to the latest version ([latestVersion]) for the best experience.', {
        latestVersion: <code>{suggestedVersion}</code>,
      })
    : t('Update to the latest version for the best experience.');

  return (
    <Alert variant="warning">
      {firstSentence} {secondSentence}
    </Alert>
  );
}
