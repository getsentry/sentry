import {Alert} from '@sentry/scraps/alert';

import {tct} from 'sentry/locale';
import {useProjectSdkNeedsUpdate} from 'sentry/utils/useProjectSdkNeedsUpdate';
import {semverCompare} from 'sentry/utils/versions/semverCompare';

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

  if (sdkName === 'sentry.php.laravel') {
    return 'sentry/sentry-laravel';
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
  /**
   * The SDK packages the project may send events with. The alert names an
   * outdated one.
   */
  packageName: string | readonly string[];
  projectId: string;
}) {
  const {isFetching, isError, data} = useProjectSdkNeedsUpdate({
    minVersion,
    projectId: [projectId],
  });

  if (isFetching || isError) {
    return null;
  }

  const packageNames = typeof packageName === 'string' ? [packageName] : packageName;
  const outdatedPackageName = data
    ?.filter(update => semverCompare(update.sdkVersion || '', minVersion) === -1)
    .map(update => getPackageNameFromSdkName(update.sdkName))
    .find(name => name !== null && packageNames.includes(name));

  if (!outdatedPackageName) {
    return null;
  }

  return (
    <Alert variant="warning">
      {tct(
        'Your [packageName] version is below the minimum required for agent monitoring.',
        {
          packageName: <code>{outdatedPackageName}</code>,
        }
      )}{' '}
      {tct('Update to [minVersionCode] or later.', {
        minVersionCode: <code>{minVersion}</code>,
      })}
    </Alert>
  );
}
