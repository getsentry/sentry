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
import {AggregateSelector} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/aggregateSelector';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useTraceMetricMultiMetricSelection} from 'sentry/views/dashboards/widgetBuilder/hooks/useTraceMetricMultiMetricSelection';
import {
  buildTraceMetricAggregate,
  extractTraceMetricFromColumn,
  getTraceMetricAggregateActionType,
  getTraceMetricAggregateSource,
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

function getDefaultAggregate(
  traceMetric: TraceMetric
): AggregationKeyWithAlias | undefined {
  const aggregate =
    DEFAULT_YAXIS_BY_TYPE[traceMetric.type] ??
    OPTIONS_BY_TYPE[traceMetric.type]?.[0]?.value;

  return aggregate as AggregationKeyWithAlias | undefined;
}

function getUpdatedAggregatesMultiMetric(
  aggregateSource: Column[],
  index: number,
  newTraceMetric: TraceMetric
): Column[] | undefined {
  const validAggregateOptions = OPTIONS_BY_TYPE[newTraceMetric.type] ?? [];
  const currentAggregateKey =
    aggregateSource?.[index]?.kind === 'function'
      ? aggregateSource[index].function[0]
      : undefined;

  if (!currentAggregateKey) {
    return undefined;
  }

  const isValid = validAggregateOptions.some(opt => opt.value === currentAggregateKey);

  const nextAggregateKey = isValid
    ? currentAggregateKey
    : getDefaultAggregate(newTraceMetric);

  if (!nextAggregateKey) {
    return undefined;
  }

  const updatedAggregate = buildTraceMetricAggregate(nextAggregateKey, newTraceMetric);

  const updatedAggregates = [...(aggregateSource ?? [])];
  updatedAggregates[index] = updatedAggregate;

  return updatedAggregates;
}

function replaceFieldWithDefaultAggregate(
  aggregateSource: Column[],
  index: number,
  traceMetric: TraceMetric
): Column[] | undefined {
  const aggregate = getDefaultAggregate(traceMetric);
  if (!aggregate) {
    return undefined;
  }

  const updatedAggregates = [...aggregateSource];
  updatedAggregates[index] = buildTraceMetricAggregate(aggregate, traceMetric);
  return updatedAggregates;
}

export function MetricSelectRow({
  disabled,
  field,
  fieldSelector,
  index,
}: {
  disabled: boolean;
  field: QueryFieldValue;
  index: number;
  fieldSelector?: (autoSelectFirstColumn: boolean) => ReactNode;
}) {
  const {state, dispatch} = useWidgetBuilderContext();
  const hasMultiMetricSelection = useTraceMetricMultiMetricSelection();
  const [shouldAutoSelectFirstColumn, setShouldAutoSelectFirstColumn] = useState(false);

  const aggregateSource = getTraceMetricAggregateSource(
    state.displayType,
    state.yAxis,
    state.fields
  );

  const traceMetric = (aggregateSource?.[index]
    ? extractTraceMetricFromColumn(aggregateSource[index])
    : undefined) ?? {name: '', type: ''};

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

      let updatedAggregates: Column[] | undefined;
      if (hasMultiMetricSelection) {
        updatedAggregates =
          field.kind === FieldValueKind.FUNCTION
            ? getUpdatedAggregatesMultiMetric(
                aggregateSource ?? [],
                index,
                newTraceMetric
              )
            : replaceFieldWithDefaultAggregate(
                aggregateSource ?? [],
                index,
                newTraceMetric
              );
      } else {
        const validAggregateOptions = OPTIONS_BY_TYPE[newTraceMetric.type] ?? [];
        updatedAggregates = (aggregateSource ?? []).map((f, aggregateIndex) => {
          if (f.kind === 'function' && f.function?.[0]) {
            const aggregate = f.function[0];
            const isValid = validAggregateOptions.some(opt => opt.value === aggregate);

            if (!isValid && validAggregateOptions.length > 0) {
              const defaultAggregate = getDefaultAggregate(newTraceMetric);
              if (defaultAggregate) {
                return buildTraceMetricAggregate(defaultAggregate, newTraceMetric);
              }
            }

            return buildTraceMetricAggregate(aggregate, newTraceMetric);
          }
          if (aggregateIndex === index) {
            const aggregate = getDefaultAggregate(newTraceMetric);
            if (aggregate) {
              return buildTraceMetricAggregate(aggregate, newTraceMetric);
            }
          }
          return f;
        });
      }

      if (!updatedAggregates) {
        return;
      }

      // Sort fixup is handled by the dispatch handlers
      // (SET_Y_AXIS, SET_FIELDS, SET_CATEGORICAL_AGGREGATE)
      dispatch({
        type: getTraceMetricAggregateActionType(state.displayType),
        payload: updatedAggregates,
      });
    },
    [aggregateSource, dispatch, field, hasMultiMetricSelection, index, state.displayType]
  );

  const onSelectField = useCallback(() => {
    if (state.displayType !== DisplayType.TABLE) {
      return;
    }

    setShouldAutoSelectFirstColumn(true);
    const newFields = [...(aggregateSource ?? [])];
    newFields[index] = {kind: FieldValueKind.FIELD, field: ''};
    dispatch({
      type: getTraceMetricAggregateActionType(state.displayType),
      payload: newFields,
    });
  }, [aggregateSource, dispatch, index, state.displayType]);

  useEffect(() => {
    if (field.kind !== FieldValueKind.FIELD) {
      setShouldAutoSelectFirstColumn(false);
    }
  }, [field.kind]);

  const hasOnlyAggregate =
    aggregateSource?.filter(
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

  return (
    <Flex gap="0" width="100%" minWidth="0">
      <MetricSelectorWrapper isFieldSelected={field.kind === FieldValueKind.FIELD}>
        <MetricSelector
          traceMetric={traceMetric}
          usePortal
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
