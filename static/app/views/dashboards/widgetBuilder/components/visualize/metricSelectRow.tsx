import cloneDeep from 'lodash/cloneDeep';

import {t} from 'sentry/locale';
import {
  type AggregationKeyWithAlias,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DisplayType} from 'sentry/views/dashboards/types';
import {
  AggregateCompactSelect,
  GroupedSelectControl,
  PrimarySelectRow,
} from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import {renderDropdownMenuFooter} from 'sentry/views/dashboards/widgetBuilder/components/visualize/selectRow';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
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

  const traceMetric =
    field.kind === 'function' && field.function[2] && field.function[3]
      ? {name: field.function[2], type: field.function[3]}
      : (state.traceMetrics?.[index] ?? {name: '', type: ''});

  const aggregateOptions = OPTIONS_BY_TYPE[traceMetric?.type ?? ''] ?? [];
  return (
    <PrimarySelectRow hasColumnParameter={false} isTraceMetrics>
      <GroupedSelectControl fullWidth>
        <MetricSelector
          traceMetric={traceMetric}
          onChange={option => {
            // gotta find the first applicable combination for the selected metric type and set it in the yAxis
            // applicable means either also grab the first aggregate if the current aggregate doesn't apply to the new metric type
            // or, if it applies that just switch the aggregate arg
            // The format is aggregate(value,metric_name,type,unit), but for now unit can just be hardcoded to '-'
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
      </GroupedSelectControl>
      <GroupedSelectControl fullWidth={false}>
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
            if (field.kind === 'function' || !field) {
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
      </GroupedSelectControl>
    </PrimarySelectRow>
  );
}
