import {Alert} from '@sentry/scraps/alert';

import {t} from 'sentry/locale';
import {useHasReplayAccess} from 'sentry/utils/replays/hooks/useHasReplayAccess';

interface ReplayAccessProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Guard component to check if the user has access to replay data based on the organization's replay permissions settings.
 */
export function ReplayAccess({children, fallback = null}: ReplayAccessProps) {
  const hasAccess = useHasReplayAccess();
  if (!hasAccess) {
    return fallback;
  }
  return children;
}

export function ReplayAccessFallbackAlert() {
  return (
    <Alert
      type="warning"
      showIcon
      defaultExpanded
      expand={t(
        'Replay access in this organization is limited to certain members. Please contact an organization admin to get access.'
      )}
    >
      {t("You don't have access to this feature")}
    </Alert>
  );
}
