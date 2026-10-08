import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {
  type DroppedDataBucket,
  formatDroppedShare,
  type OutcomeVolume,
} from 'sentry/components/droppedData/utils';
import {t} from 'sentry/locale';
import {getFormat} from 'sentry/utils/dates';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

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

function formatBucketRange(start: number, end: number, timezone: string): string {
  const startMoment = moment.tz(start, timezone);
  const endMoment = moment.tz(end, timezone);
  const showYear = startMoment.year() !== moment().year();

  const endFormat = startMoment.isSame(endMoment, 'day')
    ? getFormat({timeOnly: true, timeZone: true})
    : getFormat({year: showYear, timeZone: true});

  return `${startMoment.format(getFormat({year: showYear}))} - ${endMoment.format(endFormat)}`;
}

function totalEventCount(bucket: DroppedDataBucket): number {
  return bucket.dropped.count + bucket.accepted.count;
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
  bucket: DroppedDataBucket;
  timezone: string;
}

export function DroppedDataTooltip({bucket, timezone}: DroppedDataTooltipProps) {
  const totalEvents = totalEventCount(bucket);

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
              {...formatCountRatio(outcome.count, totalEvents)}
            />
          ))}
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
