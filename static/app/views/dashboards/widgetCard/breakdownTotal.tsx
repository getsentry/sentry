import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  getAbsoluteSummary,
  getRelativeSummary,
} from 'sentry/components/timeRangeSelector/utils';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {parseFunction} from 'sentry/utils/discover/fields';
import {DisplayType, type Widget} from 'sentry/views/dashboards/types';
import type {TimeSeriesMeta} from 'sentry/views/dashboards/widgets/common/types';
import {formatBreakdownLegendValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatBreakdownLegendValue';

/**
 * Aggregates whose value over the whole period equals the sum of the group
 * values, so the ungrouped result can be presented as a "total".
 */
const ADDITIVE_FUNCTIONS = new Set(['count', 'sum']);

/**
 * Creates an ungrouped table widget that fetches the period total for a grouped
 * breakdown widget. Querying it separately (instead of summing the breakdown
 * rows) includes groups outside the top N and spans without a group value.
 *
 * Returns `null` when the widget doesn't have a single, unambiguous total: when
 * it has several queries or aggregates, or when it isn't grouped (the breakdown
 * legend already shows the total).
 */
export function createBreakdownTotalWidget(widget: Widget): Widget | null {
  const [query, ...otherQueries] = widget.queries;
  if (!query || otherQueries.length > 0) {
    return null;
  }

  const [aggregate, ...otherAggregates] = query.aggregates;
  if (!aggregate || otherAggregates.length > 0 || query.columns.length === 0) {
    return null;
  }

  return {
    ...widget,
    displayType: DisplayType.TABLE,
    limit: 1,
    queries: [
      {...query, aggregates: [aggregate], columns: [], fields: [aggregate], orderby: ''},
    ],
  };
}

/**
 * Reads the period total from the results of a `createBreakdownTotalWidget` query.
 */
export function getBreakdownTotalValue(
  widget: Widget,
  tableResults: TableDataWithTitle[] | undefined
): number | null | undefined {
  const aggregate = widget.queries[0]?.aggregates[0];
  const row = tableResults?.[0]?.data[0];
  if (!aggregate || !row) {
    return undefined;
  }

  const value = row[aggregate];
  return typeof value === 'number' ? value : null;
}

function getPeriodSummary({period, start, end, utc}: PageFilters['datetime']) {
  if (period) {
    return getRelativeSummary(period).toLowerCase();
  }
  if (start && end) {
    return getAbsoluteSummary(start, end, utc);
  }
  return null;
}

interface BreakdownTotalProps {
  aggregate: string;
  meta: Pick<TimeSeriesMeta, 'valueType' | 'valueUnit'>;
  selection: PageFilters;
  value: number | null;
}

/**
 * Period total rendered next to the title of a breakdown legend widget.
 */
export function BreakdownTotal({aggregate, meta, selection, value}: BreakdownTotalProps) {
  const isAdditive = ADDITIVE_FUNCTIONS.has(parseFunction(aggregate)?.name ?? '');
  const periodSummary = getPeriodSummary(selection.datetime);

  const tooltip = isAdditive
    ? periodSummary
      ? t('Total for %s', periodSummary)
      : t('Total')
    : periodSummary
      ? t('Overall for %s', periodSummary)
      : t('Overall');

  return (
    <Tooltip title={tooltip} skipWrapper>
      <Flex align="baseline" gap="sm">
        <Text size="md" variant="muted" aria-hidden>
          ·
        </Text>
        <Text size="md" bold tabular>
          {formatBreakdownLegendValue(value, meta.valueType, meta.valueUnit ?? undefined)}
        </Text>
      </Flex>
    </Tooltip>
  );
}
