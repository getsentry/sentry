import type {AlertVariant} from '@sentry/scraps/theme';

import type {Config} from 'sentry/types/system';

/**
 * Maps a django message level tag to an alert variant.
 * See client config in ./src/sentry/web/client_config.py
 */
export function getDjangoMessageAlertVariant(
  level: Config['messages'][number]['level']
): AlertVariant {
  return level === 'error' ? 'danger' : level === 'debug' ? 'muted' : level;
}
