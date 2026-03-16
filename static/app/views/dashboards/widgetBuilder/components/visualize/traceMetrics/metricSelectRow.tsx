import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {
  generateFieldAsString,
  type AggregationKeyWithAlias,
  type Column,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DisplayType} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {AggregateSelector} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/aggregateSelector';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {
  buildTraceMetricAggregate,
  extractTraceMetricFromColumn,
} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {OPTIONS_BY_TYPE} from 'sentry/views/explore/metrics/constants';
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';

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

  const isTimeSeries = usesTimeSeriesData(state.displayType);
  const isCategoricalBarWidget = state.displayType === DisplayType.CATEGORICAL_BAR;
  const aggregateSource = isTimeSeries
    ? state.yAxis
    : isCategoricalBarWidget
      ? state.fields?.filter(f => f.kind === FieldValueKind.FUNCTION)
      : state.fields;

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

            const validAggregateOptions = OPTIONS_BY_TYPE[newTraceMetric.type] ?? [];
            const updatedAggregates: Column[] = (aggregateSource ?? []).map(f => {
              if (f.kind === 'function' && f.function?.[0]) {
                const aggregate = f.function[0];
                const isValid = validAggregateOptions.some(
                  opt => opt.value === aggregate
                );

                if (!isValid && validAggregateOptions.length > 0) {
                  return buildTraceMetricAggregate(
                    validAggregateOptions[0]!.value as AggregationKeyWithAlias,
                    newTraceMetric
                  );
                }

                return buildTraceMetricAggregate(aggregate, newTraceMetric);
              }
              return f;
            });

            const actionType = isTimeSeries
              ? BuilderStateAction.SET_Y_AXIS
              : isCategoricalBarWidget
                ? BuilderStateAction.SET_CATEGORICAL_AGGREGATE
                : BuilderStateAction.SET_FIELDS;

            dispatch({
              type: actionType,
              payload: updatedAggregates,
            });

            // Update the sort if the current sort is not used in any of the current fields
            if (
              state.sort &&
              state.sort.length > 0 &&
              !checkTraceMetricSortUsed(
                state.sort,
                isTimeSeries ? updatedAggregates : state.yAxis,
                isTimeSeries ? state.fields : updatedAggregates
              )
            ) {
              dispatch({
                type: BuilderStateAction.SET_SORT,
                payload:
                  updatedAggregates.length > 0
                    ? [
                        {
                          field: generateFieldAsString(updatedAggregates[0]!),
                          kind: 'desc' as const,
                        },
                      ]
                    : [],
              });
            }
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

function checkTraceMetricSortUsed(
  sort: Array<{field: string}>,
  yAxis: Column[] = [],
  fields: Column[] = []
): boolean {
  const sortValue = sort[0]?.field;
  const sortInFields = fields?.some(f => generateFieldAsString(f) === sortValue);
  const sortInYAxis = yAxis?.some(f => generateFieldAsString(f) === sortValue);
  return sortInFields || sortInYAxis;
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
