import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

/**
 * Seer only knows a monitor id when it emits the tag, so it cannot tell that a
 * monitor is a project monitor and avoid asking for a block in the first place.
 */
export function ProjectMonitor() {
  return (
    <Text variant="muted">{t('Project monitors do not support block previews.')}</Text>
  );
}
