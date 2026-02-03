import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import usePageFilters from 'sentry/utils/usePageFilters';
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

const EXPIRATION_DAYS = 30;
export const LOCAL_STORAGE_KEY = 'ai-sdk-update-dismissed';

/**
 * Displays an alert when a newer SDK version is available compared to the
 * one used by the project. Only shown when a single project is selected.
 * The alert can be dismissed for 30 days.
 */
export function SDKUpdateAlert() {
  const {selection} = usePageFilters();
  const {dismiss, isDismissed} = useDismissAlert({
    key: LOCAL_STORAGE_KEY,
    expirationDays: EXPIRATION_DAYS,
  });

  const selectedProjectIds = selection.projects.map(id => id.toString());
  const isSingleProject =
    selection.projects.length === 1 && !selection.projects.includes(ALL_ACCESS_PROJECTS);

  const {isFetching, needsUpdate, data} = useProjectSdkNeedsUpdate({
    projectId: selectedProjectIds,
    enabled: isSingleProject && !isDismissed,
  });

  if (isDismissed || isFetching || !isSingleProject || !needsUpdate) {
    return null;
  }

  const suggestedVersion = data?.[0]?.suggestions.find(
    s => s.type === 'updateSdk'
  )?.newSdkVersion;

  const packageName = getPackageNameFromSdkName(data?.[0]?.sdkName);

  const dismissLabel = t('Dismiss banner for %s days', EXPIRATION_DAYS);

  return (
    <Alert
      variant="info"
      showIcon
      trailingItems={
        <Button
          aria-label={dismissLabel}
          icon={<IconClose />}
          onClick={dismiss}
          size="zero"
          priority="transparent"
          title={dismissLabel}
        />
      }
    >
      {packageName
        ? suggestedVersion
          ? tct(
              "We've detected you're using the [packageName] package, and a newer version ([version]) is available. Update for a better experience.",
              {
                packageName: <code>{packageName}</code>,
                version: <code>{suggestedVersion}</code>,
              }
            )
          : tct(
              "We've detected you're using the [packageName] package, and a newer version is available. Update for a better experience.",
              {
                packageName: <code>{packageName}</code>,
              }
            )
        : t(
            'A newer version of the Sentry SDK is available. Update for a better experience.'
          )}
    </Alert>
  );
}
