import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {
  type AnnotationBucket,
  formatDroppedShare,
  type OutcomeVolume,
} from 'sentry/components/droppedData/utils';
import {t} from 'sentry/locale';
import {getFormat} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';

const BYTE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];
const BYTE_THRESHOLD = 1000;

interface Ratio {
  total: string;
  value: string;
}

function outcomeLabel({outcome}: OutcomeVolume): string {
  switch (outcome) {
    case 'rate_limited':
      return t('Rate Limit Rejected');
    case 'invalid':
      return t('Invalid Data Rejected');
    case 'abuse':
      return t('Abuse Limit Rejected');
    case 'cardinality_limited':
      return t('Cardinality Limit Rejected');
    case 'client_discard':
      return t('SDK Data Dropped');
    default:
      return t('Other Rejected');
  }
}

function formatCountRatio(value: number, total: number): Ratio {
  return {
    value: formatAbbreviatedNumber(value),
    total: formatAbbreviatedNumber(total),
  };
}

function formatByteRatio(value: number, total: number): Ratio {
  let unitIndex = 0;
  let scale = 1;

  while (total / scale >= BYTE_THRESHOLD && unitIndex < BYTE_UNITS.length - 1) {
    scale *= BYTE_THRESHOLD;
    unitIndex += 1;
  }

  return {
    value: formatNumberWithDynamicDecimalPoints(value / scale),
    total: `${formatNumberWithDynamicDecimalPoints(total / scale)} ${BYTE_UNITS[unitIndex]}`,
  };
}

function formatBucketRange(start: number, end: number, timezone: string): string {
  const startMoment = moment.tz(start, timezone);
  const endMoment = moment.tz(end, timezone);
  const showYear = startMoment.year() !== moment().year();

  const endFormat = startMoment.isSame(endMoment, 'day')
    ? getFormat({timeOnly: true, timeZone: true})
    : getFormat({year: showYear, timeZone: true});

  return `${startMoment.format(getFormat({year: showYear}))} - ${endMoment.format(endFormat)}`;
}

function totalEventCount(bucket: AnnotationBucket): number {
  return bucket.dropped.eventCount + bucket.accepted.eventCount;
}

function byteTotals(bucket: AnnotationBucket): {dropped: number; total: number} | null {
  const dropped = bucket.dropped.byteSize;
  if (!defined(dropped)) {
    return null;
  }
  const total = dropped + (bucket.accepted.byteSize ?? 0);

  return {dropped, total};
}

function VolumeRow({label, value, total}: Ratio & {label: string}) {
  return (
    <Flex justify="between" gap="2xl">
      <Text>{label}</Text>
      <Text tabular wrap="nowrap">
        {value}
        <Text variant="muted">/{total}</Text>
      </Text>
    </Flex>
  );
}

interface DroppedDataTooltipProps {
  bucket: AnnotationBucket;
  timezone: string;
}

export function DroppedDataTooltip({bucket, timezone}: DroppedDataTooltipProps) {
  const totalEvents = totalEventCount(bucket);
  const bytes = byteTotals(bucket);

  return (
    <Fragment>
      <TooltipBody className="tooltip-series">
        <Flex as="header" justify="between" gap="2xl" padding="lg xl">
          <Text bold>{t('Total Dropped')}</Text>
          <Text bold tabular>
            {formatDroppedShare(bucket.ratio)}
          </Text>
        </Flex>
        <Separator orientation="horizontal" />
        <Stack as="section" gap="md" padding="lg xl">
          {bucket.byOutcome.map(outcome => (
            <VolumeRow
              key={outcome.outcome}
              label={outcomeLabel(outcome)}
              {...formatCountRatio(outcome.eventCount, totalEvents)}
            />
          ))}
          {bytes && (
            <VolumeRow
              label={t('Payloads Rejected')}
              {...formatByteRatio(bytes.dropped, bytes.total)}
            />
          )}
        </Stack>
      </TooltipBody>
      <Container className="tooltip-footer tooltip-footer-centered">
        <Text size="xs" variant="muted">
          {formatBucketRange(bucket.start, bucket.end, timezone)}
        </Text>
      </Container>
      <div className="tooltip-arrow arrow-top" />
    </Fragment>
  );
}

const TooltipBody = styled(Container)`
  &&& {
    padding: 0;
  }
`;
