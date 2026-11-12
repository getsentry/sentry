import {Fragment} from 'react';
import styled from '@emotion/styled';

import {formatDateTime, type DateTimeOptions} from '@sentry/scraps/dateTime';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {parseChartDateTime} from 'sentry/components/charts/formatChartDateTime';
import {
  droppedDataLabel,
  formatDroppedShare,
  outcomeLabel,
} from 'sentry/components/droppedData/outcomes';
import type {DroppedDataBucket} from 'sentry/components/droppedData/types';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

interface Ratio {
  total: string;
  value: string;
}

function formatCountRatio(value: number, total: number): Ratio {
  return {
    value: formatAbbreviatedNumber(value),
    total: formatAbbreviatedNumber(total),
  };
}

function formatBucketRange(start: number, end: number, timezone: string): string {
  const startDate = parseChartDateTime(start, timezone);
  const endDate = parseChartDateTime(end, timezone);
  const now = parseChartDateTime(Date.now(), timezone);
  if (!startDate || !endDate || !now) {
    return 'Invalid date';
  }
  const showYear = startDate.year !== now.year;

  const year = showYear ? 'always' : 'never';
  const endOptions = startDate.toPlainDate().equals(endDate.toPlainDate())
    ? ({mode: 'time', showTimezone: true, timezone} satisfies DateTimeOptions)
    : ({year, showTimezone: true, timezone} satisfies DateTimeOptions);
  return `${formatDateTime(start, {year, showTimezone: false, timezone})} - ${formatDateTime(end, endOptions)}`;
}

function totalEventCount(bucket: DroppedDataBucket): number {
  return bucket.dropped + bucket.accepted;
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
  dataset: DiscoverDatasets;
  timezone: string;
}

export function DroppedDataTooltip({bucket, dataset, timezone}: DroppedDataTooltipProps) {
  const totalEvents = totalEventCount(bucket);

  return (
    <Fragment>
      <TooltipBody className="tooltip-series">
        <Flex as="header" justify="between" gap="2xl" padding="lg xl">
          <Text bold>{droppedDataLabel(dataset)}</Text>
          <Text bold tabular>
            {formatDroppedShare(bucket.ratio)}
          </Text>
        </Flex>
        {bucket.byOutcome.length > 0 && (
          <Fragment>
            <Separator orientation="horizontal" />
            <Stack as="section" gap="md" padding="lg xl">
              {bucket.byOutcome.map(outcome => (
                <VolumeRow
                  key={outcome.outcome}
                  label={outcomeLabel(outcome.outcome)}
                  {...formatCountRatio(outcome.count, totalEvents)}
                />
              ))}
            </Stack>
          </Fragment>
        )}
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
