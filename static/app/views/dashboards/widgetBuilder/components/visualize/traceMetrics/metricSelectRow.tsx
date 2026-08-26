import {useCallback} from 'react';
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
  index,
}: {
  disabled: boolean;
  field: QueryFieldValue;
  index: number;
}) {
  const {state, dispatch} = useWidgetBuilderContext();
  const hasMultiMetricSelection = useTraceMetricMultiMetricSelection();

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
            : (() => {
                const aggregate =
                  DEFAULT_YAXIS_BY_TYPE[newTraceMetric.type] ??
                  OPTIONS_BY_TYPE[newTraceMetric.type]?.[0]?.value;
                if (!aggregate) {
                  return;
                }
                const nextAggregates = [...(aggregateSource ?? [])];
                nextAggregates[index] = buildTraceMetricAggregate(
                  aggregate as AggregationKeyWithAlias,
                  newTraceMetric
                );
                return nextAggregates;
              })();
      } else {
        const validAggregateOptions = OPTIONS_BY_TYPE[newTraceMetric.type] ?? [];
        updatedAggregates = (aggregateSource ?? []).map((f, aggregateIndex) => {
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
          if (aggregateIndex === index) {
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

    const newFields = [...(aggregateSource ?? [])];
    newFields[index] = {kind: FieldValueKind.FIELD, field: ''};
    dispatch({
      type: getTraceMetricAggregateActionType(state.displayType),
      payload: newFields,
    });
  }, [aggregateSource, dispatch, index, state.displayType]);

  const hasOnlyAggregate =
    aggregateSource?.filter(
      aggregate => aggregate.kind === 'function' || aggregate.kind === 'equation'
    ).length === 1;

  return (
    <Flex gap="0" width="100%" minWidth="0">
      <MetricSelectorWrapper
        hasAggregateSelector={field.kind === FieldValueKind.FUNCTION}
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
    </Flex>
  );
}

const MetricSelectorWrapper = styled('div')<{hasAggregateSelector: boolean}>`
  flex: 1 1 auto;
  min-width: 0;

  button {
    border-top-right-radius: ${p => (p.hasAggregateSelector ? 0 : undefined)};
    border-bottom-right-radius: ${p => (p.hasAggregateSelector ? 0 : undefined)};
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
