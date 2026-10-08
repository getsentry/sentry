import {Tooltip} from '@sentry/scraps/tooltip';

import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';

export function GroupingFrameMarker() {
  const label = t('This frame is repeated in every event of this issue');

  return (
    <Tooltip title={label} skipWrapper>
      <span aria-label={label}>
        <IconRefresh size="sm" variant="primary" />
      </span>
    </Tooltip>
  );
}
