import {Fragment} from 'react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {ChartBandTooltipHeading} from 'sentry/components/charts/bands/chartBandTooltip';
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

interface DroppedDataTooltipSectionProps {
  bucket: DroppedDataBucket;
  dataset: DiscoverDatasets;
}

export function DroppedDataTooltipSection({
  bucket,
  dataset,
}: DroppedDataTooltipSectionProps) {
  const totalEvents = totalEventCount(bucket);

  return (
    <Container as="section">
      <ChartBandTooltipHeading
        label={droppedDataLabel(dataset)}
        value={formatDroppedShare(bucket.ratio)}
      />
      {bucket.byOutcome.length > 0 && (
        <Fragment>
          <Separator orientation="horizontal" />
          <Stack gap="md" padding="lg xl">
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
    </Container>
  );
}
