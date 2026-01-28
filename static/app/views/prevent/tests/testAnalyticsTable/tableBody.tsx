import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t, tct} from 'sentry/locale';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {
  RIGHT_ALIGNED_FIELDS,
  type Column,
  type Row,
} from 'sentry/views/prevent/tests/testAnalyticsTable/testAnalyticsTable';

interface TableBodyProps {
  column: Column;
  row: Row;
  wrapToggleValue: boolean;
}

export function renderTableBody({column, row, wrapToggleValue}: TableBodyProps) {
  const key = column.key;
  const value = row[key];
  const alignment = RIGHT_ALIGNED_FIELDS.has(key) ? 'right' : 'left';

  if (key === 'testName') {
    return (
      <Text
        monospace
        ellipsis={wrapToggleValue ? undefined : true}
        align="left"
        style={{overflowWrap: 'break-word'}}
      >
        {value}
      </Text>
    );
  }

  if (key === 'averageDurationMs') {
    return (
      <Text ellipsis tabular align="right">
        <PerformanceDuration milliseconds={Number(value)} abbreviation />
      </Text>
    );
  }

  if (key === 'flakeRate') {
    const isBrokenTest = row.isBrokenTest;

    return (
      <Flex gap="sm" align="center" justify="end">
        {isBrokenTest && <Tag variant="info">{t('Broken test')}</Tag>}
        <Tooltip
          showUnderline
          isHoverable
          maxWidth={300}
          title={tct(
            '[passedCount] Passed, [failCount] Failed, ([flakyCount] Flaky), [skipCount] Skipped',
            {
              passedCount: row.totalPassCount,
              failCount: row.totalFailCount,
              flakyCount: row.totalFlakyFailCount,
              skipCount: row.totalSkipCount,
            }
          )}
        >
          <Text tabular ellipsis>
            {formatPercentage(Number(value) / 100, 2, {minimumValue: 0.0001})}
          </Text>
        </Tooltip>
      </Flex>
    );
  }

  if (key === 'totalFailCount') {
    const totalFailCount = row.totalFailCount + row.totalFlakyFailCount;
    return (
      <Text monospace ellipsis align={alignment}>
        {totalFailCount}
      </Text>
    );
  }

  if (key === 'lastRun') {
    return (
      <Text variant="muted" align="left">
        <DateTime date={value} year seconds timeZone />
      </Text>
    );
  }

  return (
    <Text monospace ellipsis align={alignment}>
      {value}
    </Text>
  );
}
