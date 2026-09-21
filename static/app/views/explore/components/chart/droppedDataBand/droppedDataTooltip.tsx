import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {getFormat} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import type {
  AnnotationBucket,
  OutcomeVolume,
} from 'sentry/views/explore/components/chart/droppedDataBand/utils';

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
  const year = startMoment.year() !== moment().year();

  const endFormat = startMoment.isSame(endMoment, 'day')
    ? getFormat({timeOnly: true, timeZone: true})
    : getFormat({year, timeZone: true});

  return `${startMoment.format(getFormat({year}))} - ${endMoment.format(endFormat)}`;
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
  const totalEvents = bucket.dropped.eventCount + bucket.accepted.eventCount;
  const droppedBytes = bucket.dropped.byteSize;
  const totalBytes = defined(droppedBytes)
    ? droppedBytes + (bucket.accepted.byteSize ?? 0)
    : undefined;

  return (
    <Fragment>
      <TooltipBody className="tooltip-series">
        <Flex as="header" justify="between" gap="2xl" padding="lg xl">
          <Text bold>{t('Total Dropped')}</Text>
          <Text bold tabular>
            {formatPercentage(bucket.ratio, undefined, {minimumValue: 0.0001})}
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
          {defined(droppedBytes) && defined(totalBytes) && (
            <VolumeRow
              label={t('Payloads Rejected')}
              {...formatByteRatio(droppedBytes, totalBytes)}
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
