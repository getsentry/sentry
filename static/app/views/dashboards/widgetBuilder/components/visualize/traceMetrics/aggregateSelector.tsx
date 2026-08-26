import {useMemo} from 'react';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import type {
  AggregationKeyWithAlias,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {AggregateCompactSelect} from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import {sortSelectedFirst} from 'sentry/views/dashboards/widgetBuilder/components/visualize/selectRow';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {
  buildTraceMetricAggregate,
  getTraceMetricAggregateActionType,
  getTraceMetricAggregateSource,
} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
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

  const aggregateSource = getTraceMetricAggregateSource(
    state.displayType,
    state.yAxis,
    state.fields
  );
  const actionType = getTraceMetricAggregateActionType(state.displayType);

  const aggregateOptions = useMemo(
    () => OPTIONS_BY_TYPE[traceMetric?.type ?? ''] ?? [],
    [traceMetric?.type]
  );

  const aggregateValue = field.kind === 'function' ? (field.function?.[0] ?? '') : '';

  return (
    <AggregateCompactSelect
      search
      hasColumnParameter={false}
      disabled={disabled || aggregateOptions.length <= 1}
      options={sortSelectedFirst(aggregateValue, aggregateOptions)}
      value={aggregateValue}
      position="bottom-start"
      onChange={option => {
        if (field.kind === 'function') {
          const updatedAggregate = buildTraceMetricAggregate(
            option.value as AggregationKeyWithAlias,
            traceMetric
          );
          dispatch({
            type: actionType,
            payload:
              actionType === BuilderStateAction.SET_FIELDS
                ? (state.fields ?? []).map((currentField, fieldIndex) =>
                    fieldIndex === index ? updatedAggregate : currentField
                  )
                : (aggregateSource ?? []).map(currentField =>
                    currentField === field ? updatedAggregate : currentField
                  ),
          });
        }
      }}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} aria-label={t('Aggregate Selection')} />
      )}
    />
  );
}
