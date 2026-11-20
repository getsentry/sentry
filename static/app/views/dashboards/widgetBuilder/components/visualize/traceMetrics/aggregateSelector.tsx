import {useMemo} from 'react';
import cloneDeep from 'lodash/cloneDeep';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import type {
  AggregationKeyWithAlias,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {sortSelectedFirst} from 'sentry/views/dashboards/widgetBuilder/components/visualize/selectRow';
import {AggregateCompactSelect} from 'sentry/views/dashboards/widgetBuilder/components/visualize/utils';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/useWidgetBuilderContext';
import {
  buildTraceMetricAggregate,
  getTraceMetricAggregateActionType,
  getTraceMetricDisplayFields,
  getTraceMetricFunctionParts,
} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {OPTIONS_BY_TYPE} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

export function AggregateSelector({
  disabled,
  traceMetric,
  field,
  index,
  onFieldChange,
  disabledAggregates,
}: {
  disabled: boolean;
  field: QueryFieldValue;
  index: number;
  traceMetric: TraceMetric;
  disabledAggregates?: Record<string, string>;
  onFieldChange?: (field: QueryFieldValue) => void;
}) {
  const {state, dispatch} = useWidgetBuilderContext();

  const displayFields = getTraceMetricDisplayFields(
    state.displayType,
    state.yAxis,
    state.fields
  );
  const actionType = getTraceMetricAggregateActionType(state.displayType);

  const aggregateOptions = useMemo(
    () =>
      (OPTIONS_BY_TYPE[traceMetric?.type ?? ''] ?? []).map(option =>
        disabledAggregates?.[option.value]
          ? {...option, disabled: true, tooltip: disabledAggregates[option.value]}
          : option
      ),
    [traceMetric?.type, disabledAggregates]
  );

  // Hidden rows are not in the builder state, so read the column prop.
  // Visible rows read the state like before.
  const sourceField = onFieldChange ? field : (displayFields?.[index] ?? field);
  const parts = getTraceMetricFunctionParts(sourceField);
  const aggregateValue = parts?.aggregation ?? '';

  return (
    <AggregateCompactSelect
      search
      hasColumnParameter={false}
      disabled={disabled || aggregateOptions.length <= 1}
      options={sortSelectedFirst(aggregateValue, aggregateOptions)}
      value={aggregateValue}
      position="bottom-start"
      onChange={option => {
        if (field.kind !== 'function') {
          return;
        }
        const nextField = buildTraceMetricAggregate(
          option.value as AggregationKeyWithAlias,
          traceMetric,
          parts?.filter
        );
        if (onFieldChange) {
          onFieldChange(nextField);
          return;
        }
        const newAggregates = cloneDeep(displayFields) ?? [];
        newAggregates[index] = nextField;
        dispatch({type: actionType, payload: newAggregates});
      }}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} aria-label={t('Aggregate Selection')} />
      )}
    />
  );
}
