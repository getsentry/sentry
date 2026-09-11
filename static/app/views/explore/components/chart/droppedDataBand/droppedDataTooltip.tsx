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

/**
 * The values the tooltip renders. Every figure is the same drop rate,
 * `dropped / (dropped + accepted)`, in a different unit:
 *
 * - Header "Total Dropped": the count rate rendered as a percentage.
 * - "{Category} Rejected": the count rate rendered as `dropped/total`.
 * - "Payloads Rejected": the byte rate rendered as `dropped/total`.
 *
 * Only `droppedCount` is available from the API today; `acceptedCount` and the
 * byte totals are added by a follow-up backend change. The tooltip degrades
 * when they are absent: the header shows a raw dropped count instead of a
 * percentage, and the ratio/payload rows are hidden.
 */
export interface DroppedDataTooltipData {
  categoryLabel: string;
  droppedCount: number;
  /**
   * Accepted bytes for the same bucket + category. With `droppedBytes` this
   * forms the payloads `dropped/total` row.
   */
  acceptedBytes?: number;
  /**
   * Accepted count for the same bucket + category. With `droppedCount` this
   * forms the header percentage and the count `dropped/total` row.
   */
  acceptedCount?: number;
  /**
   * Dropped bytes for the bucket ("payloads").
   */
  droppedBytes?: number;
}

export function getDroppedDataTooltipData(bucket: Bucket): DroppedDataTooltipData {
  // A bucket is always built from at least one annotation (see
  // `groupIntoBuckets`), and every annotation shares the same category.
  const [firstAnnotation] = bucket.annotations;
  return {
    droppedCount: bucket.total,
    categoryLabel: firstAnnotation ? getCategoryLabel(firstAnnotation.category) : '',
  };
}

interface DroppedDataTooltipProps {
  bucket: Bucket;
  utc: boolean;
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

export function DroppedDataTooltip({bucket, utc}: DroppedDataTooltipProps) {
  const {droppedCount, categoryLabel, acceptedCount, droppedBytes, acceptedBytes} =
    getDroppedDataTooltipData(bucket);

  // Count rate: header percentage + the "{Category} Rejected" row.
  const hasCounts = typeof acceptedCount === 'number';
  const countTotal = hasCounts ? droppedCount + acceptedCount! : undefined;
  const percentage =
    countTotal && countTotal > 0
      ? Math.round((droppedCount / countTotal) * 100)
      : undefined;

  // Byte rate: the "Payloads Rejected" row.
  const hasBytes = typeof droppedBytes === 'number' && typeof acceptedBytes === 'number';
  const byteTotal = hasBytes ? droppedBytes! + acceptedBytes! : undefined;

  const range = defaultFormatAxisLabel(
    bucket.start,
    /* isTimestamp */ true,
    utc,
    /* showTimeInTooltip */ true,
    /* addSecondsToTimeFormat */ false,
    /* bucketSize */ bucket.end - bucket.start
  );

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
    (bucket: Bucket) => renderToString(<DroppedDataTooltip bucket={bucket} utc={utc} />),
    [renderToString, utc]
  );
}
