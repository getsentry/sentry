import {Alert} from '@sentry/scraps/alert';

import {tct} from 'sentry/locale';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';

function getPackageNameFromSdkName(sdkName?: string): string | null {
  if (!sdkName) {
    return null;
  }

  if (sdkName.startsWith('sentry.python')) {
    return 'sentry-sdk';
  }

  if (sdkName.startsWith('sentry.javascript.')) {
    // Extract the last part of the SDK name (e.g., "nextjs" from "sentry.javascript.nextjs")
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
  const currentVersion = sdkUpdate?.sdkVersion;

  return (
    <Alert variant="warning">
      {currentVersion
        ? tct(
            "We've detected you're using [sdkName] at version [currentVersion], which is below the minimum required version [minVersion]. Please update your SDK to enable agent monitoring.",
            {
              sdkName: <code>{packageName ?? 'an SDK'}</code>,
              currentVersion: <code>{currentVersion}</code>,
              minVersion: <code>{minVersion}</code>,
            }
          )
        : tct(
            "We've detected you're using [sdkName], which is below the minimum required version [minVersion]. Please update your SDK to enable agent monitoring.",
            {
              sdkName: <code>{packageName ?? 'an SDK'}</code>,
              minVersion: <code>{minVersion}</code>,
            }
          )}
    </Alert>
  );
}
