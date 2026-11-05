import {IconClose} from '@sentry/icons/close';

import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct} from 'sentry/locale';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {WarningIcon} from 'sentry/views/explore/components/chart/placeholder';

interface ExtrapolationConfidenceFooterProps {
  plottables: Plottable[];
}

/**
 * Summarizes the confidence of a chart's plottables. Shows a multiplier icon when any plotted data is extrapolated, and a warning when any of it is low confidence.
 */
export function ExtrapolationConfidenceFooter({
  plottables,
}: ExtrapolationConfidenceFooterProps) {
  const isExtrapolated = plottables.some(plottable => plottable.confidence !== 'full');
  const hasLowConfidence = plottables.some(
    plottable => plottable.confidence === 'low' || plottable.confidence === 'mixed'
  );

  if (!isExtrapolated) {
    return null;
  }

  return (
    <Flex align="center" gap="md">
      <Tooltip
        isHoverable
        title={tct(
          'Some of this data is extrapolated from sampled events. [link:Learn more]',
          {link: <ExternalLink href={SAMPLING_DOCS_URL} />}
        )}
      >
        {/* TODO: Replace with a dedicated multiplier icon */}
        <IconClose size="xs" variant="muted" data-test-id="extrapolation-indicator" />
      </Tooltip>
      {hasLowConfidence && (
        <Flex align="center" gap="xs">
          <WarningIcon />
          <Text size="sm" variant="muted">
            {t('Low confidence data')}
          </Text>
        </Flex>
      )}
    </Flex>
  );
}

const SAMPLING_DOCS_URL =
  'https://docs.sentry.io/product/explore/trace-explorer/#how-sampling-affects-queries-in-trace-explorer';
