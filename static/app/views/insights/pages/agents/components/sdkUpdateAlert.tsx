import {Alert} from '@sentry/scraps/alert';

import {t, tct} from 'sentry/locale';
import {useProjectSdkNeedsUpdate} from 'sentry/utils/useProjectSdkNeedsUpdate';

/**
 * Maps an SDK name to its installable package name.
 * Returns null for SDKs not supported by agent monitoring.
 */
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
  packageName,
}: {
  minVersion: string;
  packageName: string;
  projectId: string;
}) {
  const {needsUpdate, isFetching, isError, data} = useProjectSdkNeedsUpdate({
    minVersion,
    projectId: [projectId],
  });

  if (!needsUpdate || isFetching || isError) {
    return null;
  }

  const sdkUpdate = data?.find(
    update => getPackageNameFromSdkName(update.sdkName) === packageName
  );

  if (!sdkUpdate) {
    return null;
  }

  const suggestedVersion = sdkUpdate.suggestions?.find(
    suggestion => suggestion.type === 'updateSdk'
  )?.newSdkVersion;

  return (
    <Alert variant="warning">
      {tct(
        'Your [packageName] version is below the minimum required for agent monitoring.',
        {
          packageName: <code>{packageName}</code>,
        }
      )}{' '}
      {suggestedVersion
        ? tct('Update to [latestVersion] or later.', {
            latestVersion: <code>{suggestedVersion}</code>,
          })
        : t('Update to the latest version.')}
    </Alert>
  );
}
