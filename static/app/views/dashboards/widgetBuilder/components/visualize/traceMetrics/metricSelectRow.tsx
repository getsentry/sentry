import {useCallback, useEffect, useMemo, useState, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {
  type AggregationKeyWithAlias,
  type Column,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DisplayType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/useWidgetBuilderContext';
import {
  buildTraceMetricAggregate,
  extractTraceMetricFromColumn,
  getTraceMetricAggregateActionType,
  getTraceMetricDisplayFields,
  getTraceMetricFunctionParts,
} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {
  DEFAULT_YAXIS_BY_TYPE,
  doesMetricSupportHeatMapVisualization,
  OPTIONS_BY_TYPE,
} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector/metricSelector';
import type {MetricSelectorOption} from 'sentry/views/explore/metrics/metricToolbar/metricSelector/types';

import {AggregateSelector} from './aggregateSelector';

function getDefaultAggregate(
  traceMetric: TraceMetric
): AggregationKeyWithAlias | undefined {
  const aggregate =
    DEFAULT_YAXIS_BY_TYPE[traceMetric.type] ??
    OPTIONS_BY_TYPE[traceMetric.type]?.[0]?.value;

  return aggregate as AggregationKeyWithAlias | undefined;
}

/**
 * Returns the aggregate column for `field` after switching it to `newTraceMetric`.
 * Keeps the current aggregation when the new metric type supports it and keeps
 * any `_if` filter on the row.
 */
function getUpdatedAggregateField(
  field: QueryFieldValue,
  newTraceMetric: TraceMetric
): Column | undefined {
  if (field.kind !== FieldValueKind.FUNCTION) {
    const aggregate = getDefaultAggregate(newTraceMetric);
    return aggregate ? buildTraceMetricAggregate(aggregate, newTraceMetric) : undefined;
  }

  const parts = getTraceMetricFunctionParts(field);
  const currentAggregateKey = parts?.aggregation as AggregationKeyWithAlias | undefined;
  if (!currentAggregateKey) {
    return undefined;
  }

  const validAggregateOptions = OPTIONS_BY_TYPE[newTraceMetric.type] ?? [];
  const isValid = validAggregateOptions.some(opt => opt.value === currentAggregateKey);
  const nextAggregateKey = isValid
    ? currentAggregateKey
    : getDefaultAggregate(newTraceMetric);
  if (!nextAggregateKey) {
    return undefined;
  }

  return buildTraceMetricAggregate(nextAggregateKey, newTraceMetric, parts?.filter);
}

export function MetricSelectRow({
  disabled,
  field,
  fieldSelector,
  index,
  onFieldChange,
  disabledAggregates,
  excludeDefaultMetrics,
}: {
  disabled: boolean;
  field: QueryFieldValue;
  index: number;
  /**
   * Aggregations that cannot be picked for this row, with the reason shown
   * in the dropdown.
   */
  disabledAggregates?: Record<string, string>;
  /**
   * Metrics a new, empty row should not default to. They stay selectable.
   */
  excludeDefaultMetrics?: TraceMetric[];
  fieldSelector?: (autoSelectFirstColumn: boolean) => ReactNode;
  /**
   * When set, changes are reported here instead of being dispatched to the
   * widget builder state. Used for rows that are not stored in the state.
   */
  onFieldChange?: (field: QueryFieldValue) => void;
}) {
  const {state, dispatch} = useWidgetBuilderContext();
  const [shouldAutoSelectFirstColumn, setShouldAutoSelectFirstColumn] = useState(false);

  const displayFields = getTraceMetricDisplayFields(
    state.displayType,
    state.yAxis,
    state.fields
  );

  // Hidden rows are not in the builder state, so read the column prop.
  // Visible rows read the state like before.
  const sourceField = onFieldChange ? field : (displayFields?.[index] ?? field);
  const traceMetric = extractTraceMetricFromColumn(sourceField) ?? {name: '', type: ''};

  // Dashboards is visualization-first: once Heat Map is chosen, restrict the
  // metric picker to distributions (the only type a heat map can render).
  const getDisabledOptionReason = useCallback(
    (option: MetricSelectorOption) =>
      doesMetricSupportHeatMapVisualization({
        name: option.metricName,
        type: option.metricType,
        unit: option.metricUnit,
      })
        ? undefined
        : t('Heatmaps can only visualize distribution metrics.'),
    []
  );

  const onMetricChange = useCallback(
    (newTraceMetric: TraceMetric) => {
      if (!newTraceMetric) {
        return;
      }

      const updatedField = getUpdatedAggregateField(field, newTraceMetric);
      if (!updatedField) {
        return;
      }

      if (onFieldChange) {
        onFieldChange(updatedField);
        return;
      }

      const updatedAggregates = [...(displayFields ?? [])];
      updatedAggregates[index] = updatedField;

      // Sort fixup is handled by the dispatch handlers
      // (SET_Y_AXIS, SET_FIELDS, SET_CATEGORICAL_AGGREGATE)
      dispatch({
        type: getTraceMetricAggregateActionType(state.displayType),
        payload: updatedAggregates,
      });
    },
    [displayFields, dispatch, field, index, onFieldChange, state.displayType]
  );

  const onSelectField = useCallback(() => {
    if (state.displayType !== DisplayType.TABLE) {
      return;
    }

    setShouldAutoSelectFirstColumn(true);
    const newFields = [...(displayFields ?? [])];
    newFields[index] = {kind: FieldValueKind.FIELD, field: ''};
    dispatch({
      type: getTraceMetricAggregateActionType(state.displayType),
      payload: newFields,
    });
  }, [displayFields, dispatch, index, state.displayType]);

  useEffect(() => {
    if (field.kind !== FieldValueKind.FIELD) {
      // oxlint-disable-next-line react/set-state-in-effect
      setShouldAutoSelectFirstColumn(false);
    }
  }, [field.kind]);

  const hasOnlyAggregate =
    displayFields?.filter(
      aggregate => aggregate.kind === 'function' || aggregate.kind === 'equation'
    ).length === 1;
  const renderedFieldSelector = fieldSelector?.(shouldAutoSelectFirstColumn);

  const fieldOption = useMemo(() => {
    return {
      isSelected: field.kind === FieldValueKind.FIELD,
      disabledReason: hasOnlyAggregate
        ? t('Add another aggregate before adding a field.')
        : undefined,
      onSelect: onSelectField,
    };
  }, [field.kind, hasOnlyAggregate, onSelectField]);

  const skipDefaultOption = useCallback(
    (option: MetricSelectorOption) =>
      Boolean(
        excludeDefaultMetrics?.some(
          metric => metric.name === option.metricName && metric.type === option.metricType
        )
      ),
    [excludeDefaultMetrics]
  );

  return (
    <Flex gap="0" width="100%" minWidth="0">
      <MetricSelectorWrapper isFieldSelected={field.kind === FieldValueKind.FIELD}>
        <MetricSelector
          traceMetric={traceMetric}
          usePortal
          skipDefaultOption={excludeDefaultMetrics ? skipDefaultOption : undefined}
          getDisabledOptionReason={
            state.displayType === DisplayType.HEATMAP
              ? getDisabledOptionReason
              : undefined
          }
          fieldOption={state.displayType === DisplayType.TABLE ? fieldOption : undefined}
          onChange={onMetricChange}
        />
      </MetricSelectorWrapper>
      {field.kind === FieldValueKind.FUNCTION && (
        <AggregateSelectorWrapper>
          <AggregateSelector
            disabled={disabled}
            traceMetric={traceMetric}
            field={field}
            index={index}
            onFieldChange={onFieldChange}
            disabledAggregates={disabledAggregates}
          />
        </AggregateSelectorWrapper>
      )}
      {renderedFieldSelector && (
        <Flex flex="1" minWidth="0">
          {renderedFieldSelector}
        </Flex>
      )}
    </Flex>
  );
}

const MetricSelectorWrapper = styled('div')<{
  isFieldSelected: boolean;
}>`
  flex: ${p => (p.isFieldSelected ? '0 0 80px' : '1 1 auto')};
  max-width: ${p => (p.isFieldSelected ? '80px' : undefined)};
  min-width: 0;

  button {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    width: 100%;
  }

  > div {
    width: 100%;
  }
`;

const AggregateSelectorWrapper = styled('div')`
  flex: 0 0 auto;

  button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;
