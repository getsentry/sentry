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
  if (!hasLowConfidencePlottables(plottables)) {
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

/**
 * Whether `ExtrapolationConfidenceFooter` would render anything. Lets callers skip the footer slot entirely, since an empty slot still draws its chrome.
 */
export function hasLowConfidencePlottables(plottables: Plottable[]): boolean {
  return plottables.some(
    plottable => plottable.confidence === 'low' || plottable.confidence === 'mixed'
  );
}
