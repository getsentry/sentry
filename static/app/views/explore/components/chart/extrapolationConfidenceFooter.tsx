import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';

import {WarningIcon} from './placeholder';

interface ExtrapolationConfidenceFooterProps {
  plottables: Plottable[];
}

/**
 * Summarizes the confidence of a chart's plottables. Shows a warning when any plotted data is low confidence.
 */
export function ExtrapolationConfidenceFooter({
  plottables,
}: ExtrapolationConfidenceFooterProps) {
  const hasLowConfidence = plottables.some(
    plottable => plottable.confidence === 'low' || plottable.confidence === 'mixed'
  );

  if (!hasLowConfidence) {
    return null;
  }

  return (
    <Flex align="center" gap="xs">
      <WarningIcon />
      <Text size="sm" variant="muted">
        {t('Low confidence data')}
      </Text>
    </Flex>
  );
}
