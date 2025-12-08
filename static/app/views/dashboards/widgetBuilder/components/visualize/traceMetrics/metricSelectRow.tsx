import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {type QueryFieldValue} from 'sentry/utils/discover/fields';
import {AggregateSelector} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/aggregateSelector';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
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

  const traceMetric =
    field.kind === 'function' && field.function[2] && field.function[3]
      ? {name: field.function[2], type: field.function[3]}
      : (state.traceMetrics?.[index] ?? {name: '', type: ''});

  return (
    <PrimarySelectRow>
      <MetricSelectorWrapper>
        <MetricSelector
          traceMetric={traceMetric}
          onChange={option => {
            if (field.kind === 'function' || !field) {
              const newYAxes = cloneDeep(state.yAxis) ?? [];
              const newTraceMetrics = cloneDeep(state.traceMetrics) ?? [];
              newTraceMetrics[index] = {name: option.name, type: option.type};
              newYAxes[index] = {
                function: [field.function[0], 'value', undefined, undefined],
                alias: undefined,
                kind: 'function',
              };
              dispatch({
                type: BuilderStateAction.SET_TRACE_METRIC,
                payload: newTraceMetrics,
              });
              dispatch({
                type: BuilderStateAction.SET_Y_AXIS,
                payload: newYAxes,
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
    </PrimarySelectRow>
  );
}

const MetricSelectorWrapper = styled('div')`
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
  button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

const PrimarySelectRow = styled('div')`
  display: flex;
  width: 100%;
  min-width: 0;

  & > :first-child {
    flex: 1 1 auto;
    min-width: 0;
  }

  & > :last-child {
    flex: 0 0 auto;
  }
`;
