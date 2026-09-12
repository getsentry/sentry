import {Fragment, useCallback} from 'react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {useRenderToString} from '@sentry/scraps/renderToString';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import {t, tct} from 'sentry/locale';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import type {Bucket} from 'sentry/views/explore/components/chart/droppedDataBand/utils';

/**
 * EAP data categories we annotate (see `DATASET_TO_CATEGORY` in
 * `src/sentry/api/helpers/data_annotations.py`).
 */
const CATEGORY_LABELS: Record<string, string> = {
  span: t('Spans'),
  log_item: t('Logs'),
  trace_metric: t('Metrics'),
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export interface DroppedDataTooltipData {
  categoryLabel: string;
  droppedCount: number;
  acceptedBytes?: number;
  acceptedCount?: number;
  droppedBytes?: number;
}

export function getDroppedDataTooltipData(bucket: Bucket): DroppedDataTooltipData {
  const [firstAnnotation] = bucket.annotations;
  return {
    droppedCount: bucket.total,
    categoryLabel: firstAnnotation ? getCategoryLabel(firstAnnotation.category) : '',
  };
}

interface DroppedDataTooltipProps {
  data: DroppedDataTooltipData;
  range: string;
}

function RatioRow({
  label,
  dropped,
  total,
}: {
  dropped: string;
  label: React.ReactNode;
  total: string;
}) {
  return (
    <Flex justify="between" gap="2xl">
      <Text variant="muted">{label}</Text>
      <Text tabular>{`${dropped}/${total}`}</Text>
    </Flex>
  );
}

export function DroppedDataTooltip({data, range}: DroppedDataTooltipProps) {
  const {droppedCount, categoryLabel, acceptedCount, droppedBytes, acceptedBytes} = data;

  const hasCounts = typeof acceptedCount === 'number';
  const countTotal = hasCounts ? droppedCount + acceptedCount! : undefined;
  const percentage =
    countTotal && countTotal > 0
      ? Math.round((droppedCount / countTotal) * 100)
      : undefined;

  const hasBytes = typeof droppedBytes === 'number' && typeof acceptedBytes === 'number';
  const byteTotal = hasBytes ? droppedBytes! + acceptedBytes! : undefined;

  return (
    <Fragment>
      <Container padding="md xl">
        <Stack gap="sm">
          <Flex justify="between" gap="2xl">
            <Text bold>{t('Total Dropped')}</Text>
            <Text bold tabular>
              {percentage === undefined
                ? formatAbbreviatedNumber(droppedCount)
                : `${percentage}%`}
            </Text>
          </Flex>
          {(hasCounts || hasBytes) && (
            <Separator orientation="horizontal" border="primary" />
          )}
          {hasCounts && (
            <RatioRow
              label={tct('[category] Rejected', {category: categoryLabel})}
              dropped={formatAbbreviatedNumber(droppedCount)}
              total={formatAbbreviatedNumber(countTotal!)}
            />
          )}
          {hasBytes && (
            <RatioRow
              label={t('Payloads Rejected')}
              dropped={formatBytesBase2(droppedBytes!)}
              total={formatBytesBase2(byteTotal!)}
            />
          )}
        </Stack>
      </Container>
      <div className="tooltip-footer tooltip-footer-centered">
        <Stack gap="xs" align="center">
          <Text size="sm" variant="accent">
            {range}
          </Text>
          <Text size="sm" variant="accent">
            {t('Click for Details')}
          </Text>
        </Stack>
      </div>
      <div className="tooltip-arrow arrow-top" />
    </Fragment>
  );
}

export function useDroppedDataTooltipFormatter(utc: boolean) {
  const renderToString = useRenderToString();

  return useCallback(
    (bucket: Bucket) => {
      const range = String(
        defaultFormatAxisLabel(
          bucket.start,
          true,
          utc,
          true,
          false,
          bucket.end - bucket.start
        )
      );
      return renderToString(
        <DroppedDataTooltip data={getDroppedDataTooltipData(bucket)} range={range} />
      );
    },
    [renderToString, utc]
  );
}
