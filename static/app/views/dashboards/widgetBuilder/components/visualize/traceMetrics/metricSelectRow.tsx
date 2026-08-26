import {useCallback, useEffect, useState, type ReactNode} from 'react';
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
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
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
    : ((DEFAULT_YAXIS_BY_TYPE[newTraceMetric.type] ??
        validAggregateOptions[0]?.value) as AggregationKeyWithAlias);

  if (!nextAggregateKey) {
    return undefined;
  }

  const updatedAggregate = buildTraceMetricAggregate(nextAggregateKey, newTraceMetric);

  const updatedAggregates = [...(aggregateSource ?? [])];
  updatedAggregates[index] = updatedAggregate;

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
  const aggregateIndex = aggregateSource?.indexOf(field) ?? -1;
  const selectedAggregateIndex = aggregateIndex === -1 ? index : aggregateIndex;

  const traceMetric = extractTraceMetricFromColumn(
    aggregateSource?.[selectedAggregateIndex] ?? field
  ) ?? {name: '', type: ''};

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

      const actionType = getTraceMetricAggregateActionType(state.displayType);
      if (
        actionType === BuilderStateAction.SET_FIELDS &&
        field.kind === FieldValueKind.FIELD
      ) {
        const aggregate =
          DEFAULT_YAXIS_BY_TYPE[newTraceMetric.type] ??
          OPTIONS_BY_TYPE[newTraceMetric.type]?.[0]?.value;
        if (!aggregate) {
          return;
        }

        dispatch({
          type: actionType,
          payload: (state.fields ?? []).map((currentField, fieldIndex) =>
            fieldIndex === index
              ? buildTraceMetricAggregate(
                  aggregate as AggregationKeyWithAlias,
                  newTraceMetric
                )
              : currentField
          ),
        });
        return;
      }

      let updatedAggregates: Column[] | undefined;
      if (hasMultiMetricSelection) {
        updatedAggregates =
          field.kind === FieldValueKind.FUNCTION
            ? getUpdatedAggregatesMultiMetric(
                aggregateSource ?? [],
                selectedAggregateIndex,
                newTraceMetric
              )
            : (() => {
                const aggregate =
                  DEFAULT_YAXIS_BY_TYPE[newTraceMetric.type] ??
                  OPTIONS_BY_TYPE[newTraceMetric.type]?.[0]?.value;
                if (!aggregate) {
                  return;
                }
                const nextAggregates = [...(aggregateSource ?? [])];
                nextAggregates[selectedAggregateIndex] = buildTraceMetricAggregate(
                  aggregate as AggregationKeyWithAlias,
                  newTraceMetric
                );
                return nextAggregates;
              })();
      } else {
        const validAggregateOptions = OPTIONS_BY_TYPE[newTraceMetric.type] ?? [];
        updatedAggregates = (aggregateSource ?? []).map((f, currentAggregateIndex) => {
          if (f.kind === 'function' && f.function?.[0]) {
            const aggregate = f.function[0];
            const isValid = validAggregateOptions.some(opt => opt.value === aggregate);

            if (!isValid && validAggregateOptions.length > 0) {
              return buildTraceMetricAggregate(
                (DEFAULT_YAXIS_BY_TYPE[newTraceMetric.type] ??
                  validAggregateOptions[0]?.value) as AggregationKeyWithAlias,
                newTraceMetric
              );
            }

            return buildTraceMetricAggregate(aggregate, newTraceMetric);
          }
          if (currentAggregateIndex === selectedAggregateIndex) {
            const aggregate =
              DEFAULT_YAXIS_BY_TYPE[newTraceMetric.type] ??
              validAggregateOptions[0]?.value;
            if (aggregate) {
              return buildTraceMetricAggregate(
                aggregate as AggregationKeyWithAlias,
                newTraceMetric
              );
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
        type: actionType,
        payload:
          actionType === BuilderStateAction.SET_FIELDS
            ? (state.fields ?? []).map(currentField => {
                const currentAggregateIndex =
                  aggregateSource?.indexOf(currentField) ?? -1;
                return currentAggregateIndex === -1
                  ? currentField
                  : updatedAggregates[currentAggregateIndex]!;
              })
            : updatedAggregates,
      });
    },
    [
      selectedAggregateIndex,
      aggregateSource,
      dispatch,
      field,
      hasMultiMetricSelection,
      index,
      state.displayType,
      state.fields,
    ]
  );

  const onSelectField = useCallback(() => {
    if (state.displayType !== DisplayType.TABLE) {
      return;
    }

    setShouldAutoSelectFirstColumn(true);
    const newFields = [...(state.fields ?? [])];
    newFields[index] = {kind: FieldValueKind.FIELD, field: ''};
    dispatch({
      type: getTraceMetricAggregateActionType(state.displayType),
      payload: newFields,
    });
  }, [dispatch, index, state.displayType, state.fields]);

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

  return (
    <Flex gap="0" width="100%" minWidth="0">
      <MetricSelectorWrapper
        isFieldSelected={field.kind === FieldValueKind.FIELD}
        hasTrailingSelector={
          field.kind === FieldValueKind.FUNCTION || Boolean(renderedFieldSelector)
        }
      >
        <MetricSelector
          traceMetric={traceMetric}
          usePortal
          getDisabledOptionReason={
            state.displayType === DisplayType.HEATMAP
              ? getDisabledOptionReason
              : undefined
          }
          fieldOption={
            state.displayType === DisplayType.TABLE
              ? {
                  isSelected: field.kind === FieldValueKind.FIELD,
                  disabledReason: hasOnlyAggregate
                    ? t('Add another aggregate before adding a field.')
                    : undefined,
                  onSelect: onSelectField,
                }
              : undefined
          }
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
  hasTrailingSelector: boolean;
  isFieldSelected: boolean;
}>`
  flex: ${p => (p.isFieldSelected ? '0 0 80px' : '1 1 auto')};
  max-width: ${p => (p.isFieldSelected ? '80px' : undefined)};
  min-width: 0;

  button {
    border-top-right-radius: ${p => (p.hasTrailingSelector ? 0 : undefined)};
    border-bottom-right-radius: ${p => (p.hasTrailingSelector ? 0 : undefined)};
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
