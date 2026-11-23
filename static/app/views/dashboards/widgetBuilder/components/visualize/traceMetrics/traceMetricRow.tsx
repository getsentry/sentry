import {Fragment, type ReactNode} from 'react';
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
import type {MetricRow} from './rowModel';

interface TraceMetricRowProps {
  children: ReactNode;
  /**
   * Aggregate rows get a filter bar for their `_if` filter.
   */
  field: QueryFieldValue;
  alias?: ReactNode;
  disabled?: boolean;
  label?: ReactNode;
  /**
   * Without it the filter bar is not shown.
   */
  onFieldChange?: (field: QueryFieldValue) => void;
}

/**
 * Rate aggregates are not supported in equations.
 */
export const RATE_AGGREGATES_IN_EQUATION_DISABLED: Record<string, string> =
  Object.fromEntries(
    Array.from(RATE_AGGREGATES, aggregate => [
      aggregate,
      t('Rate aggregates are not supported in equations'),
    ])
  );

/**
 * Label, control, alias and filter bar of a row. Shared by visible and hidden
 * rows so they line up.
 */
export function TraceMetricRow({
  label,
  children,
  alias,
  field,
  disabled,
  onFieldChange,
}: TraceMetricRowProps) {
  const showFilter = field.kind === FieldValueKind.FUNCTION && onFieldChange;
  return (
    <Fragment>
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
    </Fragment>
  );
}

interface HiddenTraceMetricRowProps {
  onFieldChange: (field: QueryFieldValue) => void;
  onShow: () => void;
  row: MetricRow;
  disabled?: boolean;
  indent?: boolean;
  /**
   * Disables the show toggle, e.g. at the metrics cap.
   */
  showDisabledReason?: string;
}

/**
 * A metric row that only feeds an equation. Not plotted, not saved.
 */
export function HiddenTraceMetricRow({
  row,
  disabled,
  indent,
  onFieldChange,
  onShow,
  showDisabledReason,
}: HiddenTraceMetricRowProps) {
  return (
    <HiddenRow gap="xs" width="100%" data-test-id="hidden-metric-row">
      {indent && <DragHandleSpacer />}
      <FieldRow>
        <FieldBar>
          <TraceMetricRow
            label={
              <RowLabel
                label={row.label}
                hidden
                disabled={disabled}
                onToggle={onShow}
                toggleDisabledReason={showDisabledReason}
              />
            }
            field={row.field}
            disabled={disabled}
            onFieldChange={onFieldChange}
          >
            <MetricSelectRow
              disabled={!!disabled}
              field={row.field}
              index={-1}
              onFieldChange={onFieldChange}
              disabledAggregates={RATE_AGGREGATES_IN_EQUATION_DISABLED}
            />
          </TraceMetricRow>
        </FieldBar>
        <FieldExtras compact>
          <Flex alignSelf="start">
            <DeleteFieldButton
              disabled
              disabledReason={t(
                'This series is used in an equation. Remove it from the equation to delete it.'
              )}
            />
          </Flex>
        </FieldExtras>
      </FieldRow>
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
