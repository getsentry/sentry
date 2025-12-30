import {useEffect, useMemo} from 'react';
import cloneDeep from 'lodash/cloneDeep';

import {t} from 'sentry/locale';
import {
  type AggregationKeyWithAlias,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DisplayType} from 'sentry/views/dashboards/types';
import {AggregateCompactSelect} from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import {renderDropdownMenuFooter} from 'sentry/views/dashboards/widgetBuilder/components/visualize/selectRow';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {OPTIONS_BY_TYPE} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

export function AggregateSelector({
  disabled,
  traceMetric,
  field,
  index,
}: {
  disabled: boolean;
  field: QueryFieldValue;
  index: number;
  traceMetric: TraceMetric;
}) {
  const {state, dispatch} = useWidgetBuilderContext();

  const aggregateOptions = useMemo(
    () => OPTIONS_BY_TYPE[traceMetric?.type ?? ''] ?? [],
    [traceMetric?.type]
  );

  // Ensure the aggregate is valid for the trace metric type
  useEffect(() => {
    if (field.kind !== 'function' || !field.function?.[0] || !traceMetric.type) {
      return;
    }

    const aggregate = field.function[0];
    if (
      aggregate &&
      !aggregateOptions.some(option => option.value === aggregate) &&
      state.yAxis
    ) {
      const validAggregate = aggregateOptions[0]?.value;
      dispatch({
        type: BuilderStateAction.SET_Y_AXIS,
        payload:
          state.yAxis?.map((axis, i) =>
            i === index
              ? ({
                  function: [validAggregate, 'value', undefined, undefined],
                  alias: undefined,
                  kind: 'function',
                } as QueryFieldValue)
              : axis
          ) ?? [],
      });
    }
  }, [
    aggregateOptions,
    dispatch,
    index,
    state.yAxis,
    field.kind,
    field,
    traceMetric.type,
  ]);

  return (
    <AggregateCompactSelect
      searchable
      hasColumnParameter={false}
      disabled={disabled || aggregateOptions.length <= 1}
      options={aggregateOptions}
      value={
        state.yAxis?.[index]?.kind === 'function'
          ? (state.yAxis?.[index]?.function?.[0] ?? '')
          : ''
      }
      position="bottom-start"
      menuFooter={
        state.displayType === DisplayType.TABLE ? renderDropdownMenuFooter : undefined
      }
      onChange={option => {
        if (field.kind === 'function') {
          const newYAxes = cloneDeep(state.yAxis) ?? [];
          newYAxes[index] = {
            function: [
              option.value as AggregationKeyWithAlias,
              'value',
              undefined,
              undefined,
            ],
            alias: undefined,
            kind: 'function',
          };
          dispatch({
            type: BuilderStateAction.SET_Y_AXIS,
            payload: newYAxes,
          });
        }
      }}
      triggerProps={{
        'aria-label': t('Aggregate Selection'),
      }}
    />
  );
}
