import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import type {TextProps} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {CheckIndicator} from 'sentry/views/alerts/rules/uptime/checkIndicator';
import {CheckStatus, type UptimeSummary} from 'sentry/views/alerts/rules/uptime/types';

type UptimePercentProps = {
  summary: UptimeSummary;
  /**
   * Text to display at the top of the uptime percent text tooltip
   */
  note?: React.ReactNode;
  size?: TextProps<'span'>['size'];
};

export function UptimePercent({summary, note, size}: UptimePercentProps) {
  // Do not consider missed or failed checks in the downtime % calculations
  const knownChecks =
    summary.totalChecks - summary.missedWindowChecks - summary.failedChecks;

  if (knownChecks === 0) {
    return <Text variant="muted">0.0%</Text>;
  }

  const successChecks = knownChecks - summary.downtimeChecks;
  const percentFull = (successChecks / knownChecks) * 100;

  // Round down to 3 decimals
  const percent = Math.floor(percentFull * 1000) / 1000;

  const tooltip = (
    <Flex direction="column" gap="md" style={{textAlign: 'left'}}>
      {note}
      <Grid columns="max-content max-content max-content" gap="xs md">
        <span>
          <CheckIndicator status={CheckStatus.SUCCESS} width={8} />
        </span>
        <span>{t('Up Checks')}</span>
        <span>{formatAbbreviatedNumber(successChecks)}</span>
        <span>
          <CheckIndicator status={CheckStatus.FAILURE_INCIDENT} width={8} />
        </span>
        <span>{t('Down Checks')}</span>
        <span>{formatAbbreviatedNumber(summary.downtimeChecks)}</span>
      </Grid>
    </Flex>
  );

  return (
    <Tooltip skipWrapper title={tooltip}>
      <Text
        tabular
        size={size}
        variant={percent > 99 ? 'success' : percent > 95 ? 'warning' : 'danger'}
      >
        {`${percent}%`}
      </Text>
    </Tooltip>
  );
}
