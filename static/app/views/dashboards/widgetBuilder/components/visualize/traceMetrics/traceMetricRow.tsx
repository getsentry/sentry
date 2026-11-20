import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import {
  DeleteFieldButton,
  FieldBar,
  FieldExtras,
  FieldRow,
} from 'sentry/views/dashboards/widgetBuilder/components/visualize/utils';
import {
  applyTraceMetricAggregateFilter,
  extractTraceMetricFromColumn,
  getTraceMetricFunctionParts,
} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {RATE_AGGREGATES} from 'sentry/views/explore/metrics/constants';
import {MetricFilterBar} from 'sentry/views/explore/metrics/metricToolbar/filter';

import {MetricSelectRow} from './metricSelectRow';
import {RowLabel} from './rowLabel';
import type {HiddenTraceMetricRow as HiddenTraceMetricRowData} from './unifiedEquations';

interface TraceMetricRowProps {
  /**
   * The metric selector or the equation input.
   */
  children: ReactNode;
  /**
   * The column this row edits. Aggregate rows get a filter bar for their `_if`
   * filter beneath the control; equation rows do not.
   */
  field: QueryFieldValue;
  /**
   * Alias input, shown to the right of the control.
   */
  alias?: ReactNode;
  disabled?: boolean;
  /**
   * Buttons shown to the right of the row, on the control line.
   */
  extras?: ReactNode;
  /**
   * Row letter (A, B, ƒ1, ...).
   */
  label?: ReactNode;
  /**
   * Receives the column with the filter applied. Without it the filter bar is
   * not shown.
   */
  onFieldChange?: (field: QueryFieldValue) => void;
}

/**
 * Rate aggregates cannot be used inside an equation, so rows an equation uses
 * cannot pick them.
 */
export const RATE_AGGREGATES_IN_EQUATION_DISABLED: Record<string, string> =
  Object.fromEntries(
    Array.from(RATE_AGGREGATES, aggregate => [
      aggregate,
      t('Rate aggregates are not supported in equations'),
    ])
  );

/**
 * One row of the trace metrics visualize list: the row letter, the control,
 * the alias, and the filter bar beneath. Visible and hidden rows share it so
 * they line up.
 */
export function TraceMetricRow({
  label,
  children,
  alias,
  field,
  disabled,
  onFieldChange,
  extras,
}: TraceMetricRowProps) {
  const showFilter = field.kind === FieldValueKind.FUNCTION && onFieldChange;
  return (
    <FieldRow>
      <FieldBar data-testid="field-bar">
        <Flex gap="md" align="center" width="100%" minWidth="0">
          <Flex flex="3" gap="md" align="center" minWidth="0">
            {label}
            <Container flex="1" minWidth="0">
              {children}
            </Container>
          </Flex>
          {alias && (
            <Container flex="1" minWidth="0">
              {alias}
            </Container>
          )}
        </Flex>
        {showFilter && (
          <Container width="100%" minWidth="0">
            <MetricFilterBar
              traceMetric={extractTraceMetricFromColumn(field) ?? {name: '', type: ''}}
              query={getTraceMetricFunctionParts(field)?.filter ?? ''}
              disabled={disabled}
              portalTarget={document.body}
              onSearch={filter =>
                onFieldChange(applyTraceMetricAggregateFilter(field, filter))
              }
            />
          </Container>
        )}
      </FieldBar>
      {extras && (
        <FieldExtras compact>
          <Flex gap="md" align="center" alignSelf="start">
            {extras}
          </Flex>
        </FieldExtras>
      )}
    </FieldRow>
  );
}

interface HiddenTraceMetricRowProps {
  label: string;
  onFieldChange: (field: QueryFieldValue) => void;
  onShow: () => void;
  row: HiddenTraceMetricRowData;
  disabled?: boolean;
  /**
   * Leave room for the drag handle the visible rows render.
   */
  indent?: boolean;
}

/**
 * A metric row that only feeds an equation. It is not plotted and not saved on
 * its own; edits rewrite the equation that references it.
 */
export function HiddenTraceMetricRow({
  row,
  label,
  disabled,
  indent,
  onFieldChange,
  onShow,
}: HiddenTraceMetricRowProps) {
  return (
    <HiddenRow gap="xs" width="100%" data-test-id="hidden-metric-row">
      {indent && <DragHandleSpacer />}
      <TraceMetricRow
        label={<RowLabel label={label} hidden disabled={disabled} onToggle={onShow} />}
        field={row.field}
        disabled={disabled}
        onFieldChange={onFieldChange}
        extras={
          <DeleteFieldButton
            disabled
            disabledReason={t(
              'This series is only used in an equation. Remove it from the equation to delete it.'
            )}
          />
        }
      >
        <MetricSelectRow
          disabled={!!disabled}
          field={row.field}
          index={-1}
          onFieldChange={onFieldChange}
          disabledAggregates={RATE_AGGREGATES_IN_EQUATION_DISABLED}
        />
      </TraceMetricRow>
    </HiddenRow>
  );
}

const HiddenRow = styled(Flex)`
  opacity: 0.75;
`;

const DragHandleSpacer = styled('div')`
  flex-shrink: 0;
  width: 24px;
`;
