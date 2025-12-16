import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

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

  const traceMetric = state.traceMetric ?? {name: '', type: ''};

  return (
    <Flex gap="0" width="100%" minWidth="0">
      <MetricSelectorWrapper>
        <MetricSelector
          traceMetric={traceMetric}
          onChange={option => {
            if (field.kind === 'function') {
              dispatch({
                type: BuilderStateAction.SET_TRACE_METRIC,
                payload: option,
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
