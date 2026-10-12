import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

/**
 * The dot a monitor or alert embed shows beside its title: green when enabled,
 * grey when disabled, with the status spelled out in a tooltip.
 */
export function EnabledStatusIndicator({enabled}: {enabled: boolean}) {
  const label = enabled ? t('Enabled') : t('Disabled');
  return (
    <Tooltip containerDisplayMode="flex" title={label}>
      <StatusIndicator
        aria-label={label}
        animationIterationCount={1}
        variant={enabled ? 'success' : 'muted'}
      />
    </Tooltip>
  );
}
