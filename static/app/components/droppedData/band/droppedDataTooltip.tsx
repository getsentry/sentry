import {Container, Flex, Stack} from '@sentry/scraps/layout';
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

function formatRatio(
  value: number,
  total: number,
  formatValue: (value: number) => string
): Ratio {
  return {value: formatValue(value), total: formatValue(total)};
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
  formatValue?: (value: number) => string;
  label?: string;
}

export function DroppedDataTooltipSection({
  bucket,
  dataset,
  formatValue = formatAbbreviatedNumber,
  label,
}: DroppedDataTooltipSectionProps) {
  const totalEvents = totalEventCount(bucket);

  return (
    <Container as="section">
      <ChartBandTooltipHeading
        label={label ?? droppedDataLabel(dataset)}
        value={formatDroppedShare(bucket.ratio)}
      />
      {bucket.byOutcome.length > 0 && (
        <Stack gap="md" padding="0 xl lg">
          {bucket.byOutcome.map(outcome => (
            <VolumeRow
              key={outcome.outcome}
              label={outcomeLabel(outcome.outcome)}
              {...formatRatio(outcome.count, totalEvents, formatValue)}
            />
          ))}
        </Stack>
      )}
    </Container>
  );
}
