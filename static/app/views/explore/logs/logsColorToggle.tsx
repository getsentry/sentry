import {Container} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {useLogsAnsiColors} from 'sentry/views/explore/logs/logsAnsiColors';
import {AutoRefreshLabel} from 'sentry/views/explore/logs/styles';

export function LogsColorToggle() {
  const {hasColoredLogs, isColorEnabled, isToggleAvailable, setColorEnabled} =
    useLogsAnsiColors();

  if (!isToggleAvailable || !hasColoredLogs) {
    return null;
  }

  return (
    <AutoRefreshLabel>
      <Tooltip
        title={t('Show the terminal colors these logs were written with.')}
        skipWrapper
      >
        <Switch
          checked={isColorEnabled}
          onChange={() => setColorEnabled(!isColorEnabled)}
        />
      </Tooltip>
      <Container as="span" display={{zero: 'none', '3xl': 'inline'}}>
        {t('Colors')}
      </Container>
    </AutoRefreshLabel>
  );
}
