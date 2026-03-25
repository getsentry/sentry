import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {
  type AggregationKeyWithAlias,
  type Column,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {AggregateSelector} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/aggregateSelector';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useTraceMetricMultiMetricSelection} from 'sentry/views/dashboards/widgetBuilder/hooks/useTraceMetricMultiMetricSelection';
import {
  buildTraceMetricAggregate,
  extractTraceMetricFromColumn,
  getTraceMetricAggregateActionType,
  getTraceMetricAggregateSource,
} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {OPTIONS_BY_TYPE} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';

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
    : (DEFAULT_AGGREGATE_BY_TYPE[newTraceMetric.type] ??
      (validAggregateOptions[0]?.value as AggregationKeyWithAlias));

  if (!nextAggregateKey) {
    return undefined;
  }

  const updatedAggregate = buildTraceMetricAggregate(nextAggregateKey, newTraceMetric);

  const updatedAggregates = [...(aggregateSource ?? [])];
  updatedAggregates[index] = updatedAggregate;

  return updatedAggregates;
}

const DEFAULT_AGGREGATE_BY_TYPE: Record<string, AggregationKeyWithAlias> = {
  counter: 'sum',
  distribution: 'sum',
  gauge: 'avg',
};

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

  return (
    <Flex gap="0" width="100%" minWidth="0">
      <MetricSelectorWrapper>
        <MetricSelector
          traceMetric={traceMetric}
          onChange={newTraceMetric => {
            if (field.kind !== 'function' || !newTraceMetric) {
              return;
            }

            let updatedAggregates: Column[] | undefined;
            if (hasMultiMetricSelection) {
              updatedAggregates = getUpdatedAggregatesMultiMetric(
                aggregateSource ?? [],
                index,
                newTraceMetric
              );
            } else {
              const validAggregateOptions = OPTIONS_BY_TYPE[newTraceMetric.type] ?? [];
              updatedAggregates = (aggregateSource ?? []).map(f => {
                if (f.kind === 'function' && f.function?.[0]) {
                  const aggregate = f.function[0];
                  const isValid = validAggregateOptions.some(
                    opt => opt.value === aggregate
                  );

                  if (!isValid && validAggregateOptions.length > 0) {
                    return buildTraceMetricAggregate(
                      DEFAULT_AGGREGATE_BY_TYPE[newTraceMetric.type] ??
                        (validAggregateOptions[0]?.value as AggregationKeyWithAlias),
                      newTraceMetric
                    );
                  }

                  return buildTraceMetricAggregate(aggregate, newTraceMetric);
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
          }}
        />
      </MetricSelectorWrapper>
      <AggregateSelectorWrapper>
        <AggregateSelector
          disabled={disabled}
          traceMetric={traceMetric}
          field={field}
          index={index}
        />
      </AggregateSelectorWrapper>
    </Flex>
  );
}

const MetricSelectorWrapper = styled('div')`
  flex: 1 1 auto;
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
