import {useMemo} from 'react';
import cloneDeep from 'lodash/cloneDeep';

import {t} from 'sentry/locale';
import {
  type AggregationKeyWithAlias,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DisplayType} from 'sentry/views/dashboards/types';
import {isChartDisplayType} from 'sentry/views/dashboards/utils';
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

  // For chart displays, use yAxis. For Big Number, use fields array.
  const isChart = isChartDisplayType(state.displayType);
  const aggregateSource = isChart ? state.yAxis : state.fields;
  const actionType = isChart
    ? BuilderStateAction.SET_Y_AXIS
    : BuilderStateAction.SET_FIELDS;

  const aggregateOptions = useMemo(
    () => OPTIONS_BY_TYPE[traceMetric?.type ?? ''] ?? [],
    [traceMetric?.type]
  );

  return (
    <AggregateCompactSelect
      searchable
      hasColumnParameter={false}
      disabled={disabled || aggregateOptions.length <= 1}
      options={aggregateOptions}
      value={
        aggregateSource?.[index]?.kind === 'function'
          ? (aggregateSource?.[index]?.function?.[0] ?? '')
          : ''
      }
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
      triggerProps={{
        'aria-label': t('Aggregate Selection'),
      }}
    />
  );
}
