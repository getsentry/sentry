import {useMemo} from 'react';
import cloneDeep from 'lodash/cloneDeep';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import type {
  AggregationKeyWithAlias,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {AggregateCompactSelect} from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import {sortSelectedFirst} from 'sentry/views/dashboards/widgetBuilder/components/visualize/selectRow';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
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

  const aggregateValue = useMemo(() => {
    return aggregateSource?.[index]?.kind === 'function'
      ? (aggregateSource?.[index]?.function?.[0] ?? '')
      : '';
  }, [aggregateSource, index]);

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
          const newAggregates = cloneDeep(aggregateSource) ?? [];
          newAggregates[index] = buildTraceMetricAggregate(
            option.value as AggregationKeyWithAlias,
            traceMetric
          );
          dispatch({
            type: actionType,
            payload: newAggregates,
          });
        }
      }}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} aria-label={t('Aggregate Selection')} />
      )}
    />
  );
}
