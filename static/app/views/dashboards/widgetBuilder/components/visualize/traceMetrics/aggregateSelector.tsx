import {useMemo} from 'react';
import cloneDeep from 'lodash/cloneDeep';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {
  type AggregationKeyWithAlias,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DisplayType} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {AggregateCompactSelect} from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import {
  renderDropdownMenuFooter,
  sortSelectedFirst,
} from 'sentry/views/dashboards/widgetBuilder/components/visualize/selectRow';
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

  // For time-series displays, use yAxis. For other types, use fields array.
  const isTimeSeries = usesTimeSeriesData(state.displayType);
  const aggregateSource = isTimeSeries ? state.yAxis : state.fields;
  const actionType = isTimeSeries
    ? BuilderStateAction.SET_Y_AXIS
    : BuilderStateAction.SET_FIELDS;

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
      searchable
      hasColumnParameter={false}
      disabled={disabled || aggregateOptions.length <= 1}
      options={sortSelectedFirst(aggregateValue, aggregateOptions)}
      value={aggregateValue}
      position="bottom-start"
      menuFooter={
        state.displayType === DisplayType.TABLE ? renderDropdownMenuFooter : undefined
      }
      onChange={option => {
        if (field.kind === 'function') {
          const newAggregates = cloneDeep(aggregateSource) ?? [];
          newAggregates[index] = {
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
