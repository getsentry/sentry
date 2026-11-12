import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

export function AutomaticTag() {
  const tooltip = t(
    "We created this path from your stack traces and routinely keep it up to date. If it doesn't match your setup, add another path below."
  );

  return (
    <Tooltip title={tooltip} maxWidth={360} skipWrapper>
      <Tag variant="muted">{t('Automatic')}</Tag>
    </Tooltip>
  );
}
