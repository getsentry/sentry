import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tn} from 'sentry/locale';
import {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {TableToggleLabel, TableToggleText} from 'sentry/views/explore/logs/styles';
import {
  useLogsStoredReplaysOnly,
  useSetLogsStoredReplaysOnly,
} from 'sentry/views/explore/logs/useLogsStoredReplaysOnly';

export function StoredReplaysOnlyToggle() {
  const storedReplaysOnly = useLogsStoredReplaysOnly();
  const setStoredReplaysOnly = useSetLogsStoredReplaysOnly();
  const {hiddenMissingReplayCount} = useLogsPageDataQueryResult();

  return (
    <TableToggleLabel>
      <Tooltip
        title={t(
          "A replay ID is recorded on a log whether or not the replay itself was stored, so most of them don't resolve. This hides the logs whose replay is missing."
        )}
        skipWrapper
      >
        <Switch
          checked={storedReplaysOnly}
          onChange={() => setStoredReplaysOnly(!storedReplaysOnly)}
        />
      </Tooltip>
      <TableToggleText>{t('Stored replays only')}</TableToggleText>
      {hiddenMissingReplayCount > 0 && (
        <Text size="sm" variant="muted">
          {tn('%s hidden', '%s hidden', hiddenMissingReplayCount)}
        </Text>
      )}
    </TableToggleLabel>
  );
}
