import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

/**
 * Error monitors have no configuration/rules of their own to preview -- they
 * group issues rather than define thresholds.
 */
export function ErrorMonitor() {
  return (
    <Text variant="muted">{t('Error monitors do not support block previews.')}</Text>
  );
}
